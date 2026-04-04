
# Kakioki
Created by Neuwair | 🍋 Illustrator and Programmer | イラストレーター兼プログラミング学生
- [Twitter](https://x.com/neuwair) | [Pixiv](https://www.pixiv.net/en/users/102019144) | [Insta](https://www.instagram.com/neuwair404) | [YouTube](https://www.youtube.com/@Neuwair)
<img width="2500" height="1000" alt="Untitled-1" src="https://github.com/user-attachments/assets/5f46774a-7446-46a1-9575-0a28bef2bb0a" />

## My second programming project
Kakioki is a technical showcase built to demonstrate my understanding of modern web development and application architecture.
It’s an MSN Messenger–inspired chat web application featuring end-to-end encryption via [Libsodium](https://doc.libsodium.org/), real-time communication and
user status updates through [Ably](https://ably.com/), and secure password handling with [Argon2](https://github.com/P-H-C/phc-winner-argon2). The project is built with React, TypeScript, and Next.js,
styled with Tailwind CSS, and hosted serverlessly on [Vercel](https://vercel.com/), with [NeonDB](https://neon.com/) as its database.

The design combines glassmorphism and subtle glossy reflections to evoke a clean, early-2000s aesthetic while maintaining a modern look.
It includes dark mode, consistent UI dynamics, and detailed error logging for testing and debugging.

💻 **Kakioki isn’t a production-ready messenger, it’s an MVP created to showcase what I can achieve as a solo developer**

Good things take time.
- [🍋 Kakioki Website](https://kakioki.vercel.app/)
> [!TIP]
> **You don’t need to use a real email address, accounts are automatically deleted after 2 days.**

## 🧩 Challenges I faced while creating Kakioki
Kakioki is the first project where I’ve worked with frameworks, and naturally, it took some time to get comfortable with them.
However, the most challenging aspect wasn’t the frameworks themselves but implementing end-to-end encryption. Even after studying
documentation and experimenting with AI tools, it remained difficult to make everything function correctly, for instance, messages
would encrypt successfully, but the recipient couldn’t decrypt or view them properly.

I also had to re-organise the database schema and completely re-create encryption with [Libsodium](https://doc.libsodium.org/). I had to switch password hashing from using
Libsodium to Argon2. Media compression was also a little complicated, but naturally, libraries like [Sharp](https://sharp.pixelplumbing.com/) made things much better.

Getting started with React was challenging at first, but I got used to it pretty quickly, and it now feels far more efficient and intuitive than working with plain HTML, CSS, and JavaScript.
Tailwind can feel a bit messy, but in my experience, it’s much more efficient and faster than plain CSS though, as always, it’s a trade-off.

## UI Overview
### Dark mode
<img width="396" height="816" alt="1" src="https://github.com/user-attachments/assets/258c32db-482b-43e3-a5f2-0f1f80bfbff0" />
<img width="397" height="813" alt="3" src="https://github.com/user-attachments/assets/64fa2248-3907-4a48-9213-843b2ca9414f" />

### Friend search
<img width="597" height="309" alt="2" src="https://github.com/user-attachments/assets/4df4825e-1c18-4850-ac67-b5dfb0061f7e" />
<img width="597" height="613" alt="5" src="https://github.com/user-attachments/assets/1f6ae646-8e7d-4589-8e73-0164c5c7fc28" />

### Avatar cropper
<img width="393" height="814" alt="4" src="https://github.com/user-attachments/assets/d2779655-60db-4136-a76b-7aed2e374e8c" />

### Chat interface
<img width="598" height="614" alt="7" src="https://github.com/user-attachments/assets/41dd1683-e1d5-45be-a610-693dda4317ae" />
<img width="597" height="613" alt="8" src="https://github.com/user-attachments/assets/3074284d-32cd-40f8-90fa-46af66130a09" />
<img width="599" height="615" alt="9" src="https://github.com/user-attachments/assets/e966e3a4-b84e-4c3b-957f-cf4e3835bbaa" />

# FAQ
## How does the user authentication work?
**Server route validates inputs, hashes the password with Argon2, generates a Libsodium keypair, encrypts the private key with the user password,
and persists the user record (public key, encrypted private key blob, hash, metadata) via UserRepository into NeonDB.**  Server route verifies the
Argon2 password hash, returns a JWT plus the stored public key and the password‑encrypted private key blob so the client can unlock it. JWTs are
issued/verified by TokenLogic on the server. API routes call authenticateRequest / requireAuth to extract and verify the Bearer token and rehydrate
the user from the repository.

**AuthProvider holds auth state and token (sessionStorage), refreshes the profile via /auth/me, and exposes helpers (isAuthenticated, login, logout) to UI/hooks.**
The client uses the libsodium wrapper to decrypt the encrypted private key with the user password when needed, enabling end‑to‑end crypto operations (message encryption/decryption).
Protected endpoints and realtime server endpoints require valid JWTs, realtime token endpoints generate Ably tokens after requireAuth succeeds so presence and channels are tied to authenticated users.

## How is the database implemented?
**Connection uses NeonDB via a serverless client exported from DatabaseConnections.ts so each serverless API handler imports the shared sql client.** the SQL schema lives in schema.sql
(enables pg_trgm and defines the core tables such as users). All DB access is encapsulated in repository classes under lib/Logic and lib/Repository (UserRepository, FriendRepository, MessageRepository).
Handlers in app/Routes/*.

## How does the media system work?
**This system operates in two parts, the client prepares media through selection, cropping, and compression, while the server handles validation, processing via Sharp, and storage of both media and metadata.**
On the client side, interfaces such as AvatarCropUI, AvatarUploadUI, MediaGridUI, MessageMediaPreviewUI, and InlineVideoPlayer manage user interactions, supported by tools and hooks like AvatarCropper, VideoCompressor,
SharpResizing, and AvatarUploadHooks, which handle transformations and prepare FormData for upload.

**The client enforces constraints such as size and format before sending data to /Routes/upload. On the server side, route.ts in app/Routes validates requests and files, while lib/Tools/SharpConfig and lib/Tools/MediaProcessor
handle resizing, thumbnail generation, and safe re-encoding, limited by a 4 MB SERVER_MAX_BYTES cap.** Processed files are stored and referenced through MessageRepository to associate them with message metadata.
Additionally, link previews are supported on messages, the server fetches page metadata in app/Routes/link-preview/route.ts, and the client displays it using LinkPreviewUI and LinkPreviewInputUI.
