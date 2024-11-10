import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { SipClient } from "livekit-server-sdk";
import { env } from "~/env";
const sipClient = new SipClient(
  env.LIVEKIT_API_ENDPOINT,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    const {
      phoneNumber,
      script,
    }: {
      phoneNumber: string;
      script: string;
    } = req.body as {
      phoneNumber: string;
      script: string;
    };
    // const organization = await db.organization.findUnique({
    //   where: {
    //     id: organizationId,
    //   },
    //   select: {
    //     context: true,
    //     KnowledgeBase: {
    //       select: {
    //         Faqs: {
    //           select: {
    //             question: true,
    //             answer: true,
    //           },
    //         },
    //       },
    //     },
    //   },
    // });
    // if (!organization?.context) {
    //   return res.status(404).json({
    //     error: "Organization not found for the provided phone number",
    //   });
    // }

    // return res.status(200).json({
    //   context: `This the broad details ${organization.context}
    //     And this is some of the extra details -

    //     ${organization?.KnowledgeBase?.map((kb) => kb.Faqs.map((faq) => `${faq.question} - ${faq.answer}`)).join("\n")}`,
    // });

    const session = await db.externalSession.create({
      data: {
        phoneNumber: phoneNumber,
        context: script,
      },
    });

    if (!session) {
      return res.status(405).end(`Session was not created.`);
    }

    try {
      const roomName = `call-${session.id}`;

      const sipParticipant = await sipClient.createSipParticipant(
        env.LIVEKIT_SIP_TRUNK_ID,
        phoneNumber,
        roomName,
        {
          participantIdentity: phoneNumber,
          participantName: "Phone Caller",
          playRingtone: true,
        },
      );

      console.log("SIP Participant created:", sipParticipant);
      return res.status(200).json({
        roomName,
        participant: sipParticipant,
        message: "SIP Participant created",
        session,
      });
    } catch (error) {
      console.error("Error creating SIP participant:", error);
      return res.status(405).end(`Error creating SIP participant`);
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
