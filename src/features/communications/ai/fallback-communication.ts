import type {
  CommunicationContext,
  CommunicationEvidenceItem,
  CommunicationGenerationOutput,
  CommunicationWarning,
} from "../types";
import type { CommunicationLanguage } from "@/generated/prisma/client";

type Copy = {
  hello: string;
  helloTeam: string;
  regards: string;
  attached: string;
  interested: string;
  followUp: string;
  secondFollowUp: string;
  thankYouInterview: string;
  postInterview: string;
  offerAck: string;
  offerTime: string;
  offerAccept: string;
  offerDecline: string;
  offerNegotiate: string;
  offerClarify: string;
  rejected: string;
  general: string;
  coverOpen: string;
  coverClose: string;
  outreachPurpose: string;
};

const COPY: Record<CommunicationLanguage, Copy> = {
  ENGLISH: {
    hello: "Hello",
    helloTeam: "Hello Hiring Team",
    regards: "Best regards",
    attached: "I have attached my resume for your review.",
    interested: "I remain interested in the opportunity",
    followUp:
      "I'm following up regarding my application for {role} at {company}. I remain interested in the opportunity and would appreciate any update you can share regarding the process.",
    secondFollowUp:
      "I'm following up again regarding my application for {role} at {company}. I remain interested and would appreciate any update you can share.",
    thankYouInterview:
      "Thank you for the conversation regarding the {role} role at {company}. I appreciated the opportunity to meet and remain interested in the next steps.",
    postInterview:
      "I'm following up after our interview for the {role} role at {company}. I remain interested and would appreciate any update you can share when convenient.",
    offerAck:
      "Thank you for the offer regarding the {role} role at {company}. I confirm I have received it and will review the details.",
    offerTime:
      "Thank you for the offer regarding the {role} role at {company}. I would appreciate a little time to review the details and will follow up after I have done so.",
    offerAccept:
      "Thank you for the offer regarding the {role} role at {company}. I am pleased to accept based on the terms you have shared.",
    offerDecline:
      "Thank you for the offer regarding the {role} role at {company}. After careful consideration, I will decline at this time. I appreciate the opportunity.",
    offerNegotiate:
      "Thank you for the offer regarding the {role} role at {company}. I would like to discuss the compensation details you have shared and understand whether there is flexibility.",
    offerClarify:
      "Thank you for the offer regarding the {role} role at {company}. Could you please clarify the terms that are not yet specified so I can review them carefully?",
    rejected:
      "Thank you for considering my application for the {role} role at {company}. I appreciate the time your team spent and would be glad to stay in touch for future opportunities.",
    general:
      "I am writing regarding the {role} role at {company}. Please let me know if any additional information would be helpful.",
    coverOpen:
      "I am writing to express interest in the {role} role at {company}.",
    coverClose:
      "Thank you for your time and consideration.",
    outreachPurpose:
      "I am reaching out about the {role} role at {company}.",
  },
  ARABIC: {
    hello: "مرحباً",
    helloTeam: "مرحباً فريق التوظيف",
    regards: "مع أطيب التحيات",
    attached: "أرفقت سيرتي الذاتية للاطلاع.",
    interested: "ما زلت مهتماً بالفرصة",
    followUp:
      "أتابع بشأن طلبي لوظيفة {role} في {company}. ما زلت مهتماً بالفرصة وأقدّر أي تحديث يمكن مشاركته حول سير العملية.",
    secondFollowUp:
      "أتابع مجدداً بشأن طلبي لوظيفة {role} في {company}. ما زلت مهتماً وأقدّر أي تحديث يمكن مشاركته.",
    thankYouInterview:
      "شكراً على المحادثة بشأن وظيفة {role} في {company}. قدّرت فرصة اللقاء وما زلت مهتماً بالخطوات التالية.",
    postInterview:
      "أتابع بعد المقابلة بشأن وظيفة {role} في {company}. ما زلت مهتماً وأقدّر أي تحديث عند تيسّر ذلك.",
    offerAck:
      "شكراً على العرض المتعلق بوظيفة {role} في {company}. أؤكد استلامه وسأراجع التفاصيل.",
    offerTime:
      "شكراً على العرض المتعلق بوظيفة {role} في {company}. أقدّر منحي وقتاً لمراجعة التفاصيل وسأعود إليكم بعد ذلك.",
    offerAccept:
      "شكراً على العرض المتعلق بوظيفة {role} في {company}. يسعدني قبول العرض بناءً على الشروط التي شاركتموها.",
    offerDecline:
      "شكراً على العرض المتعلق بوظيفة {role} في {company}. بعد التفكير قررت الاعتذار في الوقت الحالي، مع تقديري للفرصة.",
    offerNegotiate:
      "شكراً على العرض المتعلق بوظيفة {role} في {company}. أود مناقشة تفاصيل التعويض التي شاركتموها ومعرفة ما إذا كانت هناك مرونة.",
    offerClarify:
      "شكراً على العرض المتعلق بوظيفة {role} في {company}. هل يمكن توضيح الشروط غير المحددة بعد حتى أراجعها بدقة؟",
    rejected:
      "شكراً على النظر في طلبي لوظيفة {role} في {company}. أقدّر وقت الفريق ويسعدني البقاء على تواصل لفرص قادمة.",
    general:
      "أكتب بخصوص وظيفة {role} في {company}. أخبروني إن كان هناك أي معلومات إضافية مفيدة.",
    coverOpen: "أكتب للتعبير عن اهتمامي بوظيفة {role} في {company}.",
    coverClose: "شكراً لوقتكم واهتمامكم.",
    outreachPurpose: "أتواصل بخصوص وظيفة {role} في {company}.",
  },
  TURKISH: {
    hello: "Merhaba",
    helloTeam: "Merhaba İşe Alım Ekibi",
    regards: "Saygılarımla",
    attached: "Özgeçmişimi incelemeniz için ekledim.",
    interested: "Fırsata ilgim devam ediyor",
    followUp:
      "{company} bünyesindeki {role} başvuru sürecim hakkında bilgi almak istiyorum. Fırsata ilgim devam ediyor; süreçle ilgili paylaşabileceğiniz bir güncelleme olursa memnun olurum.",
    secondFollowUp:
      "{company} bünyesindeki {role} başvurum hakkında tekrar bilgi almak istiyorum. Fırsata ilgim devam ediyor; paylaşabileceğiniz bir güncelleme olursa memnun olurum.",
    thankYouInterview:
      "{company} bünyesindeki {role} rolü hakkında görüşme için teşekkür ederim. Görüşme fırsatını değerli buldum ve sonraki adımlara ilgim devam ediyor.",
    postInterview:
      "{company} bünyesindeki {role} görüşmesinin ardından bilgi almak istiyorum. İlgim devam ediyor; uygun olduğunda bir güncelleme paylaşırsanız memnun olurum.",
    offerAck:
      "{company} bünyesindeki {role} teklifi için teşekkür ederim. Teklifi aldığımı teyit ederim ve ayrıntıları inceleyeceğim.",
    offerTime:
      "{company} bünyesindeki {role} teklifi için teşekkür ederim. Ayrıntıları inceleyebilmem için kısa bir süre isterim; ardından dönüş yapacağım.",
    offerAccept:
      "{company} bünyesindeki {role} teklifi için teşekkür ederim. Paylaştığınız koşullara dayanarak teklifi kabul ediyorum.",
    offerDecline:
      "{company} bünyesindeki {role} teklifi için teşekkür ederim. Değerlendirme sonrasında şu aşamada teklifi kabul edemeyeceğim. Fırsat için teşekkür ederim.",
    offerNegotiate:
      "{company} bünyesindeki {role} teklifi için teşekkür ederim. Paylaştığınız ücretlendirme ayrıntılarını görüşmek ve esneklik olup olmadığını anlamak isterim.",
    offerClarify:
      "{company} bünyesindeki {role} teklifi için teşekkür ederim. Henüz net olmayan koşulları açıklamanızı rica ederim; böylece ayrıntıları dikkatle inceleyebilirim.",
    rejected:
      "{company} bünyesindeki {role} başvurumu değerlendirdiğiniz için teşekkür ederim. Ayırdığınız zaman için minnettarım ve ilerideki fırsatlar için iletişimde kalmaktan memnuniyet duyarım.",
    general:
      "{company} bünyesindeki {role} rolü hakkında yazıyorum. Ek bilgi faydalı olacaksa lütfen haber verin.",
    coverOpen: "{company} bünyesindeki {role} rolüne olan ilgimi belirtmek için yazıyorum.",
    coverClose: "Zamanınız ve değerlendirmeniz için teşekkür ederim.",
    outreachPurpose: "{company} bünyesindeki {role} rolü hakkında iletişime geçiyorum.",
  },
};

function fill(template: string, role: string, company: string): string {
  return template.replaceAll("{role}", role).replaceAll("{company}", company);
}

function greeting(context: CommunicationContext, copy: Copy): string {
  if (context.contact.name) return `${copy.hello} ${context.contact.name},`;
  if (context.settings.recipientMode === "HIRING_TEAM") return `${copy.helloTeam},`;
  return `${copy.hello},`;
}

function signature(context: CommunicationContext, copy: Copy): string {
  const lines = [copy.regards];
  if (context.user.name) lines.push(context.user.name);
  if (context.user.email) lines.push(context.user.email);
  return lines.join("\n");
}

function roleCompany(context: CommunicationContext): { role: string; company: string } {
  return {
    role: context.job.title?.trim() || "this role",
    company: context.job.company?.trim() || "the company",
  };
}

function evidenceFromContext(context: CommunicationContext): CommunicationEvidenceItem[] {
  const items: CommunicationEvidenceItem[] = [];
  if (context.job.title) items.push({ label: context.job.title, source: "job" });
  if (context.job.company) items.push({ label: context.job.company, source: "job" });
  for (const point of context.resume.experiencePoints.slice(0, 2)) {
    items.push({ label: point.slice(0, 120), source: "resume" });
  }
  for (const skill of context.resume.coreSkills.slice(0, 2)) {
    items.push({ label: skill, source: "resume" });
  }
  if (context.application?.appliedAt) {
    items.push({ label: `Application status ${context.application.status}`, source: "application" });
  }
  if (context.contact.name) {
    items.push({ label: context.contact.name, source: "contact" });
  }
  return items.slice(0, 6);
}

function warningsFromContext(context: CommunicationContext): CommunicationWarning[] {
  const warnings: CommunicationWarning[] = [
    {
      code: "rule_based_fallback",
      message: "AI unavailable; rule-based fallback used.",
    },
  ];
  if (!context.contact.name) {
    warnings.push({ code: "no_contact_name", message: "No recruiter name available." });
  }
  if (context.resume.versionStatus === "DRAFT") {
    warnings.push({
      code: "resume_not_ready",
      message: "The selected resume has not been marked Ready.",
    });
  }
  if (!context.job.company) {
    warnings.push({
      code: "no_employer_culture",
      message: "No employer-specific culture information is stored.",
    });
  }
  if (
    context.settings.type === "OFFER_RESPONSE" &&
    context.settings.offerIntent === "NEGOTIATE" &&
    !context.application?.salaryNotes
  ) {
    warnings.push({
      code: "no_salary",
      message: "No salary information is stored.",
    });
  }
  return warnings;
}

function joinLetter(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n\n");
}

export function buildFallbackCommunication(
  context: CommunicationContext,
): CommunicationGenerationOutput {
  const copy = COPY[context.settings.language];
  const { role, company } = roleCompany(context);
  const head = greeting(context, copy);
  const sign = signature(context, copy);
  const evidence = context.resume.experiencePoints[0] ?? context.resume.coreSkills[0] ?? null;
  const evidenceLine = evidence
    ? context.settings.language === "ARABIC"
      ? `من واقع سيرتي: ${evidence}`
      : context.settings.language === "TURKISH"
        ? `Özgeçmişimde yer alan ilgili deneyim: ${evidence}`
        : `From my resume: ${evidence}`
    : null;

  let subject: string | null = null;
  let body: string;

  switch (context.settings.type) {
    case "COVER_LETTER":
      subject = null;
      body = joinLetter([
        head,
        fill(copy.coverOpen, role, company),
        evidenceLine,
        context.resume.experiencePoints[1]
          ? context.settings.language === "ARABIC"
            ? `كذلك: ${context.resume.experiencePoints[1]}`
            : context.settings.language === "TURKISH"
              ? `Ayrıca: ${context.resume.experiencePoints[1]}`
              : `I can also point to: ${context.resume.experiencePoints[1]}`
          : null,
        copy.coverClose,
        sign,
      ]);
      break;
    case "APPLICATION_EMAIL":
      subject =
        context.settings.language === "ARABIC"
          ? `طلب: ${role} — ${company}`
          : context.settings.language === "TURKISH"
            ? `Başvuru: ${role} — ${company}`
            : `Application: ${role} — ${company}`;
      body = joinLetter([
        head,
        fill(copy.coverOpen, role, company),
        evidenceLine,
        context.resume.revisionId ? copy.attached : null,
        sign,
      ]);
      break;
    case "RECRUITER_OUTREACH":
      subject =
        context.settings.language === "ARABIC"
          ? `${role} — ${company}`
          : `${role} — ${company}`;
      body = joinLetter([head, fill(copy.outreachPurpose, role, company), evidenceLine, sign]);
      break;
    case "FOLLOW_UP":
      subject =
        context.settings.language === "ARABIC"
          ? `متابعة: ${role}`
          : context.settings.language === "TURKISH"
            ? `Takip: ${role}`
            : `Follow-up: ${role}`;
      body = joinLetter([
        head,
        fill(
          (context.application?.followUpSentCount ?? 0) >= 1 ? copy.secondFollowUp : copy.followUp,
          role,
          company,
        ),
        sign,
      ]);
      break;
    case "INTERVIEW_THANK_YOU":
      subject =
        context.settings.language === "ARABIC"
          ? `شكراً على المقابلة — ${role}`
          : context.settings.language === "TURKISH"
            ? `Görüşme için teşekkür — ${role}`
            : `Thank you — ${role}`;
      body = joinLetter([head, fill(copy.thankYouInterview, role, company), sign]);
      break;
    case "POST_INTERVIEW_FOLLOW_UP":
      subject =
        context.settings.language === "ARABIC"
          ? `متابعة بعد المقابلة — ${role}`
          : context.settings.language === "TURKISH"
            ? `Görüşme sonrası takip — ${role}`
            : `Post-interview follow-up — ${role}`;
      body = joinLetter([head, fill(copy.postInterview, role, company), sign]);
      break;
    case "OFFER_RESPONSE": {
      const intent = context.settings.offerIntent ?? "ACKNOWLEDGE";
      const templates = {
        ACKNOWLEDGE: copy.offerAck,
        ASK_FOR_TIME: copy.offerTime,
        ACCEPT: copy.offerAccept,
        DECLINE: copy.offerDecline,
        NEGOTIATE: copy.offerNegotiate,
        ASK_CLARIFICATION: copy.offerClarify,
      } as const;
      subject =
        context.settings.language === "ARABIC"
          ? `بخصوص العرض — ${role}`
          : context.settings.language === "TURKISH"
            ? `Teklif hakkında — ${role}`
            : `Regarding the offer — ${role}`;
      const salaryNote =
        intent === "NEGOTIATE" && context.application?.salaryNotes
          ? context.application.salaryNotes
          : null;
      body = joinLetter([head, fill(templates[intent], role, company), salaryNote, sign]);
      break;
    }
    case "GENERAL_PROFESSIONAL_MESSAGE":
    default:
      subject =
        context.settings.language === "ARABIC"
          ? `${role} — ${company}`
          : `${role} — ${company}`;
      body = joinLetter([
        head,
        fill(
          context.application?.status === "REJECTED" ? copy.rejected : copy.general,
          role,
          company,
        ),
        sign,
      ]);
      break;
  }

  return {
    subject,
    content: body,
    evidenceUsed: evidenceFromContext(context),
    warnings: warningsFromContext(context),
    changeLog: [{ action: "RULE_BASED_FALLBACK", detail: "Conservative factual template used." }],
  };
}
