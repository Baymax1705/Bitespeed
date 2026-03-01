import express, { type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Bitespeed Identity Reconciliation API');
});

app.post('/identify', async (req: Request, res: Response) => {
    try {
        const { email, phoneNumber } = req.body;

        if (!email && !phoneNumber) {
            return res.status(400).json({ error: 'At least one of email or phoneNumber is required' });
        }

        const emailStr = email ? String(email) : null;
        const phoneStr = phoneNumber ? String(phoneNumber) : null;

        // 1. Find directly matching contacts
        const matchingContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    ...(emailStr ? [{ email: emailStr }] : []),
                    ...(phoneStr ? [{ phoneNumber: phoneStr }] : [])
                ]
            }
        });

        // 2. If no matches, create a new primary contact
        if (matchingContacts.length === 0) {
            const newContact = await prisma.contact.create({
                data: {
                    email: emailStr,
                    phoneNumber: phoneStr,
                    linkPrecedence: 'primary'
                }
            });

            return res.status(200).json({
                contact: {
                    primaryContatctId: newContact.id,
                    emails: newContact.email ? [newContact.email] : [],
                    phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                    secondaryContactIds: []
                }
            });
        }

        // 3. Find the entire cluster of related contacts
        // We collect all primary IDs involved.
        const primaryIds = new Set<number>();
        for (const contact of matchingContacts) {
            if (contact.linkPrecedence === 'primary') {
                primaryIds.add(contact.id);
            } else if (contact.linkedId) {
                primaryIds.add(contact.linkedId);
            }
        }

        // In a rare case, if a secondary didn't resolve directly to a primary in the first pass,
        // we query all contacts with `id` in primaryIds or `linkedId` in primaryIds.
        // Iteratively finding all might be needed but for this requirement, 1 level is enough
        // since all secondaries point directly to primaries based on the creation logic.
        const allClusterContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { id: { in: Array.from(primaryIds) } },
                    { linkedId: { in: Array.from(primaryIds) } }
                ]
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // 4. Identify the absolute oldest contact
        const oldestContact = allClusterContacts[0];

        // 5. Demote any other primary contacts and redirect their secondaries
        const contactsToDemoteOrRedirect = allClusterContacts.filter(
            (c) => c.id !== oldestContact.id && (c.linkPrecedence === 'primary' || c.linkedId !== oldestContact.id)
        );

        if (contactsToDemoteOrRedirect.length > 0) {
            await prisma.contact.updateMany({
                where: { id: { in: contactsToDemoteOrRedirect.map((c: any) => c.id) } },
                data: { linkPrecedence: 'secondary', linkedId: oldestContact.id }
            });
            // Update local array for response processing
            contactsToDemoteOrRedirect.forEach((c: any) => {
                c.linkPrecedence = 'secondary';
                c.linkedId = oldestContact.id;
            });
        }

        // 6. Check if we need to create a new secondary contact
        // A new secondary is created if there is a new piece of information (email or phone)
        // that DOES NOT exist in ANY of the existing cluster contacts.
        // IMPORTANT: Only create if the request actually contains new valid info, not null.
        const existingEmails = new Set(allClusterContacts.map((c: any) => c.email).filter(Boolean));
        const existingPhones = new Set(allClusterContacts.map((c: any) => c.phoneNumber).filter(Boolean));

        const isNewEmail = emailStr && !existingEmails.has(emailStr);
        const isNewPhone = phoneStr && !existingPhones.has(phoneStr);

        let newSecondaryContact = null;

        // We only create a new secondary if we are bringing in new information
        // If BOTH are new, they wouldn't have matched anything! So at most one is new, and the other matched.
        // Or, both exist but on DIFFERENT contacts, which we already merged.
        // Wait, what if someone sends a completely new email but an existing phone?
        // This is exactly when we create a secondary!
        if (isNewEmail || isNewPhone) {
            newSecondaryContact = await prisma.contact.create({
                data: {
                    email: emailStr,
                    phoneNumber: phoneStr,
                    linkedId: oldestContact.id,
                    linkPrecedence: 'secondary'
                }
            });
            allClusterContacts.push(newSecondaryContact);
        }

        // 7. Prepare final response
        const uniqueEmails = new Set<string>();
        const uniquePhones = new Set<string>();
        const secondaryIds: number[] = [];

        // The primary contact's email and phone MUST be the first elements
        if (oldestContact.email) uniqueEmails.add(oldestContact.email);
        if (oldestContact.phoneNumber) uniquePhones.add(oldestContact.phoneNumber);

        for (const c of allClusterContacts) {
            if (c.id !== oldestContact.id) {
                secondaryIds.push(c.id);
            }
            if (c.email) uniqueEmails.add(c.email);
            if (c.phoneNumber) uniquePhones.add(c.phoneNumber);
        }

        // Add new secondary if not already in allClusterContacts
        // (Wait, we pushed it to allClusterContacts, but let's be sure about the order)
        // Since uniqueEmails and uniquePhones are Sets, adding them again is a no-op, but it keeps the
        // primary values first.

        res.status(200).json({
            contact: {
                primaryContatctId: oldestContact.id,
                emails: Array.from(uniqueEmails),
                phoneNumbers: Array.from(uniquePhones),
                secondaryContactIds: secondaryIds
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
