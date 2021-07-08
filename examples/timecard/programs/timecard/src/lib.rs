//! A simple timecard program using a ring buffer to store timecards.

use anchor_lang::prelude::*;

#[program]
pub mod timecard {
    use super::*;

    pub fn create_user(ctx: Context<CreateUser>, name: String) -> Result<()> {
        ctx.accounts.user.name = name;
        ctx.accounts.user.authority = *ctx.accounts.authority.key;
        Ok(())
    }
    pub fn create_employer(ctx: Context<CreateEmployer>, name: String) -> Result<()> {
        let given_name = name.as_bytes();
        let mut name = [0u8; 280];
        name[..given_name.len()].copy_from_slice(given_name);
        let mut timecard = ctx.accounts.employer.load_init()?;
        timecard.name = name;
        Ok(())
    }
    pub fn send_timecard(ctx: Context<SendTimecard>, tc: String) -> Result<()> {
        let mut timecard = ctx.accounts.employer.load_mut()?;
        timecard.append({
            let src = tc.as_bytes();
            let mut data = [0u8; 280];
            data[..src.len()].copy_from_slice(src);
            Timecard {
                from: *ctx.accounts.user.to_account_info().key,
                data,
            }
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateUser<'info> {
    #[account(init, associated = authority, space = 312)]
    user: ProgramAccount<'info, User>,
    #[account(signer)]
    authority: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
    system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CreateEmployer<'info> {
    #[account(init)]
    employer: Loader<'info, Employer>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SendTimecard<'info> {
    #[account(associated = authority, has_one = authority)]
    user: ProgramAccount<'info, User>,
    #[account(signer)]
    authority: AccountInfo<'info>,
    #[account(mut)]
    employer: Loader<'info, Employer>,
}

#[associated]
pub struct User {
    name: String,
    authority: Pubkey,
}

#[account(zero_copy)]
pub struct Employer {
    head: u64,
    tail: u64,
    name: [u8; 280],              // Human readable name (char bytes).
    timecards: [Timecard; 33607], // Leaves the account at 10,485,680 bytes.
}

impl Employer {
    fn append(&mut self, tc: Timecard) {
        self.timecards[Employer::index_of(self.head)] = tc;
        if Employer::index_of(self.head + 1) == Employer::index_of(self.tail) {
            self.tail += 1;
        }
        self.head += 1;
    }
    fn index_of(counter: u64) -> usize {
        std::convert::TryInto::try_into(counter % 33607).unwrap()
    }
}

#[zero_copy]
pub struct Timecard {
    pub from: Pubkey,
    pub data: [u8; 280],
}

#[error]
pub enum ErrorCode {
    Unknown,
}
