import { prisma } from "@/server/db/prisma";

import type { ApplicationContactInput } from "../types";
import {
  ApplicationAccessError,
  assertApplicationOwnedByUser,
} from "./application-permissions";
import { recordApplicationEvent } from "./create-application-event";

const NAME_LIMIT = 120;
const FIELD_LIMIT = 200;
const NOTES_LIMIT = 1_000;

function cleanOptional(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, limit) : null;
}

function validateContactInput(raw: unknown): ApplicationContactInput {
  if (typeof raw !== "object" || raw === null) {
    throw new ApplicationAccessError("INVALID_INPUT", "Provide contact details.");
  }

  const record = raw as Record<string, unknown>;
  const name = cleanOptional(record.name, NAME_LIMIT);

  if (!name) {
    throw new ApplicationAccessError("INVALID_INPUT", "Contact name is required.");
  }

  return {
    name,
    role: cleanOptional(record.role, FIELD_LIMIT),
    company: cleanOptional(record.company, FIELD_LIMIT),
    email: cleanOptional(record.email, FIELD_LIMIT),
    phone: cleanOptional(record.phone, FIELD_LIMIT),
    linkedinUrl: cleanOptional(record.linkedinUrl, FIELD_LIMIT),
    notes: cleanOptional(record.notes, NOTES_LIMIT),
    isPrimary: record.isPrimary === true,
  };
}

export async function addApplicationContact(
  userId: string,
  applicationId: string,
  raw: unknown,
) {
  await assertApplicationOwnedByUser(userId, applicationId);
  const input = validateContactInput(raw);

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.applicationContact.updateMany({
        where: { applicationId, userId },
        data: { isPrimary: false },
      });
    }

    const contact = await tx.applicationContact.create({
      data: {
        applicationId,
        userId,
        name: input.name,
        role: input.role ?? null,
        company: input.company ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        notes: input.notes ?? null,
        isPrimary: input.isPrimary ?? false,
      },
      select: { id: true, name: true },
    });

    await recordApplicationEvent(tx, {
      applicationId,
      userId,
      type: "CONTACT_ADDED",
      source: "USER",
      title: "Contact added",
      description: input.role ? `${input.name} · ${input.role}` : input.name,
    });

    await tx.application.update({
      where: { id: applicationId },
      data: { lastActivityAt: new Date() },
    });

    return contact;
  });
}

export async function updateApplicationContact(
  userId: string,
  applicationId: string,
  contactId: string,
  raw: unknown,
) {
  await assertApplicationOwnedByUser(userId, applicationId);

  const existing = await prisma.applicationContact.findFirst({
    where: { id: contactId, applicationId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApplicationAccessError("NOT_FOUND", "Contact not found for this application.");
  }

  const input = validateContactInput(raw);

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.applicationContact.updateMany({
        where: { applicationId, userId, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    const contact = await tx.applicationContact.update({
      where: { id: contactId },
      data: {
        name: input.name,
        role: input.role ?? null,
        company: input.company ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        notes: input.notes ?? null,
        isPrimary: input.isPrimary ?? false,
      },
      select: { id: true, name: true },
    });

    await recordApplicationEvent(tx, {
      applicationId,
      userId,
      type: "CONTACT_UPDATED",
      source: "USER",
      title: "Contact updated",
      description: input.role ? `${input.name} · ${input.role}` : input.name,
    });

    await tx.application.update({
      where: { id: applicationId },
      data: { lastActivityAt: new Date() },
    });

    return contact;
  });
}
