import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';

describe("Firestore Security Rules Hardening Suite", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "ai-studio-55fe4463-77dd-445d-b421-7cde2c80d871",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // 1. UN_AUTHENTICATED BLOCKED
  test("unauthenticated users are strictly blocked from both reading and writing all collections", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    
    // Sundays
    await assertFails(getDoc(doc(unauthedDb, "sundays/sunday1")));
    await assertFails(setDoc(doc(unauthedDb, "sundays/sunday1"), { id: "sunday1", date: "2026-06-14" }));

    // Users
    await assertFails(getDoc(doc(unauthedDb, "users/user1")));
    await assertFails(setDoc(doc(unauthedDb, "users/user1"), { uid: "user1", email: "user1@c.org", role: "Viewer" }));
  });

  // 2. VIEW_ER READ-ONLY EXCEPT SELF PROFILE CREATION
  test("authenticated viewers can read but cannot perform updates/writes to sundays or people", async () => {
    // Viewer authenticated context (with email_verified: true)
    const viewerContext = testEnv.authenticatedContext("viewer_id", {
      email: "volunteer@church.org",
      email_verified: true,
    });
    const viewerDb = viewerContext.firestore();

    // Create viewer profile in db
    const bootstrapAdmin = testEnv.authenticatedContext("admin_id", {
      email: "ales.lajlar@gmail.com",
      email_verified: true,
    }).firestore();
    
    await setDoc(doc(bootstrapAdmin, "users/viewer_id"), {
      uid: "viewer_id",
      email: "volunteer@church.org",
      displayName: "Volunteer One",
      role: "Viewer",
    });

    // Check Viewer can read Sunday rosters
    await assertSucceeds(getDoc(doc(viewerDb, "sundays/sunday1")));

    // Check Viewer is forbidden from creating/editing sundays, people, or ministries
    await assertFails(setDoc(doc(viewerDb, "sundays/sunday1"), {
      id: "sunday1",
      date: "2026-06-14",
      themeSl: "Tema",
      themeEn: "Theme",
      status: "draft",
      guest: "",
      assignments: {},
      absentOrNotes: "",
    }));

    await assertFails(setDoc(doc(viewerDb, "people/John_Doe"), {
      name: "John Doe",
      preferredMinistries: [],
    }));
  });

  // 3. COORDINATOR CAN EDIT ALLOWED COLLECTIONS ONLY (SUNDAYS & PEOPLE)
  test("coordinators can edit sundays and people, but are blocked from creating/updating ministries", async () => {
    const coordId = "coordinator_id";
    const bootstrapAdmin = testEnv.authenticatedContext("admin_id", {
      email: "ales.lajlar@gmail.com",
      email_verified: true,
    }).firestore();

    // Setup coordinator profile
    await setDoc(doc(bootstrapAdmin, `users/${coordId}`), {
      uid: coordId,
      email: "coordinator@church.org",
      displayName: "Church Leader",
      role: "Coordinator",
    });

    // Coordinator context
    const coordDb = testEnv.authenticatedContext(coordId, {
      email: "coordinator@church.org",
      email_verified: true,
    }).firestore();

    // Allowed: Sunday write
    await assertSucceeds(setDoc(doc(coordDb, "sundays/sunday2"), {
      id: "sunday2",
      date: "2026-06-21",
      themeSl: "Nedeljska Tema",
      themeEn: "Sunday Theme",
      status: "draft",
      guest: "Pastor A",
      assignments: {},
      absentOrNotes: "",
    }));

    // Allowed: People write
    await assertSucceeds(setDoc(doc(coordDb, "people/Mark_Smith"), {
      name: "Mark Smith",
      preferredMinistries: ["cleaning", "kids"],
    }));

    // Blocked: Ministries creation/edition (Only Admin)
    await assertFails(setDoc(doc(coordDb, "ministries/cleaning"), {
      id: "cleaning",
      nameSl: "Čiščenje",
      nameEn: "Cleaning",
      category: "cleaning",
      color: "#ff0000",
    }));
  });

  // 4. ADMIN CAN MANAGE ROLES
  test("admins can manage user roles and promote/demote members", async () => {
    const adminDb = testEnv.authenticatedContext("admin_id", {
      email: "ales.lajlar@gmail.com",
      email_verified: true,
    }).firestore();

    const normalUserDoc = doc(adminDb, "users/target_user_id");

    // Admin seeds user profile as Viewer
    await setDoc(normalUserDoc, {
      uid: "target_user_id",
      email: "member@church.org",
      displayName: "Member",
      role: "Viewer",
    });

    // Admin updates their role to Coordinator
    await assertSucceeds(updateDoc(normalUserDoc, {
      role: "Coordinator",
    }));
  });

  // 5. USERS CANNOT PROMOTE THEMSELVES (OR SELF-ASSIGN ROLES)
  test("non-admins are strictly blocked from promoting their own roles or self-assigning a high role on creation", async () => {
    const targetUserId = "scammer_id";
    const scammerDb = testEnv.authenticatedContext(targetUserId, {
      email: "scammer@church.org",
      email_verified: true,
    }).firestore();

    // Scenario A: Self-assign role other than "Viewer" during creation
    await assertFails(setDoc(doc(scammerDb, `users/${targetUserId}`), {
      uid: targetUserId,
      email: "scammer@church.org",
      displayName: "Scammer",
      role: "Coordinator", // Escapes baseline creation limits
    }));

    // Scenario B: Allowed to self-create as Viewer
    await assertSucceeds(setDoc(doc(scammerDb, `users/${targetUserId}`), {
      uid: targetUserId,
      email: "scammer@church.org",
      displayName: "Scammer",
      role: "Viewer",
    }));

    // Scenario C: Self-promote to "Admin" via update
    await assertFails(updateDoc(doc(scammerDb, `users/${targetUserId}`), {
      role: "Admin",
    }));
  });

  // 6. BOOTSTRAP ADMIN LOGIC WORKS CORRECTLY
  test("bootstrap admin email (ales.lajlar@gmail.com) is automatically fully authorized as Admin if verified", async () => {
    const adminDb = testEnv.authenticatedContext("bootstrap_admin_uid", {
      email: "ales.lajlar@gmail.com",
      email_verified: true,
    }).firestore();

    // Bootstrap admin is allowed to write to ministries collection immediately
    await assertSucceeds(setDoc(doc(adminDb, "ministries/kids"), {
      id: "kids",
      nameSl: "Delo z otroki",
      nameEn: "Kids Work",
      category: "kids",
      color: "#eab308",
    }));
  });

  // 7. INVALID OVERSIZED OR MALFORMED WRITES ARE REJECTED
  test("malformed schema properties, invalid category values, and oversized fields are rejected", async () => {
    const adminDb = testEnv.authenticatedContext("admin_id", {
      email: "ales.lajlar@gmail.com",
      email_verified: true,
    }).firestore();

    // Scenario A: Malformed category on ministry
    await assertFails(setDoc(doc(adminDb, "ministries/other_min"), {
      id: "other_min",
      nameSl: "Drugo",
      nameEn: "Other",
      category: "super_category", // Invalid enum!
      color: "#ccc",
    }));

    // Scenario B: Oversized note size on Sunday (limit is 3000 chars)
    const giantNote = "x".repeat(3501);
    await assertFails(setDoc(doc(adminDb, "sundays/sunday_giant"), {
      id: "sunday_giant",
      date: "2026-06-28",
      themeSl: "Tema",
      themeEn: "Theme",
      status: "draft",
      guest: "",
      assignments: {},
      absentOrNotes: giantNote,
    }));
  });
});
