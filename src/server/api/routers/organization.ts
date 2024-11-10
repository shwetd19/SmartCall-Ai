import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { clerkClient } from "@clerk/clerk-sdk-node";

export const organizationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({ name: z.string().min(1), adminEmail: z.string().email() }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.organization.create({
        data: {
          name: input.name,
          adminEmail: input.adminEmail,
          adminClerkUserId: ctx.auth.userId,
        },
      });
    }),

  addContext: protectedProcedure
    .input(z.object({ context: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const organization = await ctx.db.organization.findUnique({
        where: { adminClerkUserId: ctx.auth.userId },
      });

      if (!organization) {
        throw new Error("Organization not found for this user.");
      }

      return ctx.db.organization.update({
        where: { adminClerkUserId: ctx.auth.userId },
        data: { context: input.context },
      });
    }),

  getContext: protectedProcedure.query(async ({ ctx }) => {
    // Check if an organization exists for this user
    let organization = await ctx.db.organization.findUnique({
      where: { adminClerkUserId: ctx.auth.userId },
      select: { context: true },
    });

    // If not, fetch user details from Clerk and create a default organization
    if (!organization) {
      const user = await clerkClient.users.getUser(ctx.auth.userId);

      // Get the user's primary email address
      const primaryEmail = user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId,
      )?.emailAddress;

      if (!primaryEmail) {
        throw new Error("User email not found");
      }

      // Create organization with user's details
      organization = await ctx.db.organization.create({
        data: {
          // Use user's full name if available, otherwise use email prefix
          name:
            user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}'s Organization`
              : `${primaryEmail.split("@")[0]}'s Organization`,
          adminEmail: primaryEmail,
          adminClerkUserId: ctx.auth.userId,
        },
        select: { context: true },
      });
    }

    return organization;
  }),
});
