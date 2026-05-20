import "next-auth";
import "next-auth/jwt";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      anonymizedId: string;
    };
  }

  interface User {
    role: UserRole;
    anonymizedId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    anonymizedId: string;
  }
}
