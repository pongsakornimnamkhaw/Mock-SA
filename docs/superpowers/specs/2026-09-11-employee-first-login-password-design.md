# Employee First-Login Password Setup Design

## Goal

New employees created by an administrator must establish a private password before they can use the staff portal. Their initial credential is their registered phone number, but it may only be used to start the one-time setup flow and must never grant backoffice access.

## User flow

1. An administrator creates an employee with name, employee code, email, phone, department, role, and module permissions.
2. The backend hashes the registered phone number as the initial credential and marks the employee as requiring a password change.
3. On the employee login page, the new employee enters their employee code or email and the registered phone number.
4. If the credential is correct and password setup is required, the backend returns a short-lived, single-use setup token without creating an employee session.
5. The frontend stores the setup token in `sessionStorage` and navigates to `/employee/setup-password`.
6. The employee enters and confirms a new password. The password must satisfy the existing employee password policy.
7. The backend validates and consumes the setup token, hashes the new password, clears the password-change requirement, revokes any employee sessions, and records an audit event.
8. The frontend removes the setup token and returns to `/employee/login` with a success message. The employee then signs in normally and is sent to `/dashboard`.

Existing seeded employees and existing real employees keep their current passwords and are not forced through setup.

## Data model and migration

Add `MustChangePassword bool` to `models.User`, mapped to a non-null boolean column with default `false`. AutoMigrate creates the column without changing existing accounts.

Add a dedicated onboarding-token model with:

- token ID
- employee user ID
- SHA-256 token hash
- expiration time
- used time
- created time

Only the random token is returned to the browser. The database stores only its hash. Tokens expire after 30 minutes and are single-use.

## Backend behavior

### Employee creation

For a newly created employee only:

- validate that the phone is present and normalized by the existing validation;
- bcrypt-hash the phone into `password_hash`;
- set `must_change_password = true`.

Editing an existing employee does not reset their password or change the flag.

### Login

After credential verification:

- normal employee: create the normal employee session and return account data;
- employee requiring setup: create a one-time onboarding token and return HTTP 200 with `requires_password_setup: true` and the raw setup token; do not create a cookie/session and do not return usable backoffice account state.

The response remains deliberately generic for invalid identifiers and passwords.

### Setup endpoint

Add `POST /api/employee/auth/setup-password` with the setup token in `X-Employee-Setup-Token` and body fields `new_password` and `confirm_password`.

Inside one transaction, lock the token and user, validate expiration and unused state, update the password hash and flag, mark the token used, invalidate all other unused onboarding tokens and employee sessions, and write an audit log. Reuse the existing employee password validator.

## Frontend behavior

Extend the employee login response mapping with the password-setup outcome. When returned, save only the setup token to `sessionStorage` and navigate to `/employee/setup-password`; do not save an employee session.

Create a focused setup-password page using the existing staff authentication visual style. It contains new password, confirmation, visibility toggle, validation feedback, and submit button. Missing, invalid, expired, or used tokens return the user to employee login with a clear error. Successful setup returns to login with a success message.

The employee login page reads the success marker and shows confirmation that the password was set. Normal successful login continues to navigate to `/dashboard`.

## Security and error handling

- Never store the initial phone number or new password in plaintext.
- Never place the setup token in a URL, application log, or audit detail.
- Apply `Cache-Control: no-store` to setup responses.
- Do not create an authenticated employee session until a normal login occurs after setup.
- Revoke outstanding setup tokens on successful setup and when an administrator deactivates the employee.
- Return specific safe messages for expired/used setup tokens without exposing account existence during login.

## Testing

Backend tests cover new-account hashing and flagging, existing-account preservation, first-login setup response without session cookie, normal login, invalid/expired/used token rejection, successful password setup, one-time consumption, session revocation, and audit creation.

Frontend tests cover first-login navigation without saving an employee session, setup form validation, missing-token handling, successful completion returning to login, normal login to dashboard, and API request/response mapping. Run all Go tests, all frontend tests, frontend build, lint, and diff checks before completion.
