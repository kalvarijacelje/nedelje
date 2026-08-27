# Firestore Security Specification

This specification governs the validation, structure, and access control policies for our Church Worship Hub Schedule.

## 1. Security Invariants
- **Authentication**: All writes (create, update, delete) must be performed by authenticated users whose emails have been verified.
- **Strict Role Boundaries**:
  - **Admin**: Can perform all read and write actions across all collections, including assigning roles to users.
  - **Coordinator**: Can read everything, create/update/duplicate Sundays and People, but cannot change user roles or delete records without supervision (or let's define their actions clearly).
  - **Viewer**: Read-only access to all collections except their own user profile document.
- **Identity Integrity**: No user may spoof their email, self-assign a higher role on creation, or modify other users' roles.
- **Temporal and Content Integrity**:
  - Custom names, date formats, themes must fit size boundaries.
  - No orphaned Sunday services or infinite notes size.

## 2. The "Dirty Dozen" Payloads

1. **Self-Promoting Creator**: Creating a new user account profile in `/users/{userId}` where the payload assigns themselves `"role": "Admin"`.
2. **Ghost-Field Injection**: Appending a ghost field like `"isSuperAdmin": true` to a Sunday or Person document update.
3. **Identity Spoofing**: An authenticated user `userA` attempting to write to `/users/userB`.
4. **Viewer Write Intrusion**: An authenticated user with `"role": "Viewer"` attempting to update assignments on a Sunday.
5. **Privilege Escalation of Coordinator**: A coordinator attempting to update other users' documents to make them Admins.
6. **Trash ID Poisoning**: Trying to create a Sunday document with ID containing 1.5MB of junk characters, violating ID format matches.
7. **Size Attack on Tema**: Injecting a 500KB string into `themeSl` to exceed storage and crash standard queries.
8. **Negative and Spoofed Timestamps**: Overwriting `createdAt` with a historical or spoofed future date.
9. **Roster Erasure**: A Coordinator attempting to call `delete` on a Sunday service to erase the historic archives.
10. **Malicious Empty Fields**: Attempting to create a `Person` with empty strings or null keys.
11. **Spoofed Email Profile**: Attempting to register under `ales.lajlar@gmail.com` without verification or with email spoofing.
12. **Status Bypass**: Directly changing Sunday status to a terminal value `"completed"` without valid coordinator inputs or from raw Viewer sessions.

## 3. Test Cases (Declarative Logic Guards)
We ensure that every operation returns `PERMISSION_DENIED` unless it satisfies:
- `isSignedIn() && request.auth.token.email_verified == true`
- Valid Schema Verification helper (`isValid[Entity]`)
- Role authorization using `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role` or dynamic check.
- System-defined field limits and immutability controls.
