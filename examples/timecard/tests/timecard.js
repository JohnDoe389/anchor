const anchor = require("@project-serum/anchor");
const assert = require("assert");
const employer = anchor.web3.Keypair.generate();

describe("timecard", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // Program client handle.
  const program = anchor.workspace.Timecard;
  const employer = anchor.web3.Keypair.generate();


  it("Creates employer", async () => {
    await program.rpc.createEmployer("Test employer", {
      accounts: {
        employer: employer.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      instructions: [
        await program.account.employer.createInstruction(employer),
      ],
      signers: [employer],
    });

    const e = await program.account.employer.fetch(employer.publicKey);
    const name = new TextDecoder("utf-8").decode(new Uint8Array(e.name));
    assert.ok(name.startsWith("Test employer")); // [u8; 280] => trailing zeros.
    assert.ok(e.timecards.length === 33607);
    assert.ok(e.head.toNumber() === 0);
    assert.ok(e.tail.toNumber() === 0);
  });

  it("Creates a user", async () => {
    const authority = program.provider.wallet.publicKey;
    await program.rpc.createUser("My User", {
      accounts: {
        user: await program.account.user.associatedAddress(authority),
        authority,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    });
    const account = await program.account.user.associated(authority);
    assert.ok(account.name === "My User");
    assert.ok(account.authority.equals(authority));
  });

  it("Sends timecards", async () => {
    const authority = program.provider.wallet.publicKey;
    const user = await program.account.user.associatedAddress(authority);

    // Only send a couple timecards so the test doesn't take an eternity.
    const numTimecards = 5;

    // Generate random timecard strings.
    const timecards = new Array(numTimecards).fill("").map((msg) => {
      return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
      );
    });

    // Send each timecard.
    for (let k = 0; k < numTimecards; k += 1) {
      await program.rpc.sendTimecard(timecards[k], {
        accounts: {
          user,
          authority,
          employer: employer.publicKey,
        },
      });
    }

    // Check the timecard employer state is as expected.
    const e = await program.account.employer.fetch(employer.publicKey);
    const name = new TextDecoder("utf-8").decode(new Uint8Array(e.name));
    assert.ok(name.startsWith("Test employer")); // [u8; 280] => trailing zeros.
    assert.ok(e.timecards.length === 33607);
    assert.ok(e.head.toNumber() === numTimecards);
    assert.ok(e.tail.toNumber() === 0);
    e.timecards.forEach((tc, idx) => {
      if (idx < numTimecards) {
        const data = new TextDecoder("utf-8").decode(new Uint8Array(tc.data));
        assert.ok(tc.from.equals(user));
        assert.ok(data.startsWith(timecards[idx]));
      } else {
        assert.ok(anchor.web3.PublicKey.default);
        assert.ok(
          JSON.stringify(tc.data) === JSON.stringify(new Array(280).fill(0))
        );
      }
    });
  });
});
