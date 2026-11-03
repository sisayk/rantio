import { CONTACT_EMAIL } from "@/lib/content";
import type { LegalTexts } from ".";

const UPDATED = "Last updated: 3 November 2026";

export const en: LegalTexts = {
  privacy: {
    title: "Privacy policy",
    description: "How Rantio handles the personal data of guests, cottage owners and website visitors.",
    updated: UPDATED,
    intro:
      "This policy explains what personal data Rantio collects, why, who sees it and what your rights are. We collect as little as we can and keep it in the EU.",
    sections: [
      {
        heading: "Who we are",
        paragraphs: [
          "Rantio is a trading name of Elda-Auto Tmi, a Finnish sole proprietorship (business ID 2565459-6, VAT FI25654596). Elda-Auto Tmi is the controller of the personal data described here.",
          `Questions about privacy, or a request about your own data: ${CONTACT_EMAIL}. We answer within a month, usually much sooner.`,
        ],
      },
      {
        heading: "Guests who send a question to an owner",
        paragraphs: [
          "When you use the contact form on a cottage page, we save what you write and pass it to the cottage owner. We use your email address to send you a private link to the conversation and to tell you when the owner replies. Anyone who has the link can read the conversation, so keep it to yourself.",
          "Legal basis: our legitimate interest in delivering the question you asked us to deliver and letting the owner answer it (GDPR article 6(1)(f)).",
          "What we save:",
        ],
        list: [
          "Your name and email address",
          "The dates and number of guests, if you give them",
          "Your messages and the owner's replies",
          "The language of the site, so we can write to you in it",
        ],
      },
      {
        heading: "Cottage owners",
        paragraphs: [
          "When you sign up, we save the details from the sign-up form so we can contact you and plan your listings. If you become a customer, we also keep your account, your cottages, bookings, fees and invoices. You sign in with a one-time code sent to your email; codes stop working after 15 minutes and are stored only in scrambled (hashed) form.",
          "Legal basis: steps you asked for before a contract, and your consent in the sign-up form (article 6(1)(b) and (a)); carrying out the owner service agreement (6(1)(b)); and keeping the accounting records Finnish law requires (6(1)(c)).",
          "What we save:",
        ],
        list: [
          "Your name, email address and phone number, if you give it",
          "Country, region, number of cottages, Nettimökki link and message from the sign-up form",
          "Your cottages' descriptions, photos, prices and calendars",
          "Bookings, yearly fees, commissions, invoices and whether they're paid (payments go through Stripe; we never see or store card numbers)",
          "Your messages with guests and with us",
        ],
      },
      {
        heading: "Newsletter",
        paragraphs: [
          "If you sign up for our newsletter at the bottom of a page, we save your email address and the site's language, and send you a link to confirm. You're on the list only after you click it. We then email you now and then about new cottages, seasons and travel in the Nordics and the Baltics. Every newsletter has a link to unsubscribe, and the confirmation page has one too.",
          "Legal basis: your consent (article 6(1)(a)), which you can withdraw at any time by unsubscribing. Sign-ups nobody confirms are deleted after 30 days. If you unsubscribe, we keep only your address and the date, so that we don't email you again.",
        ],
      },
      {
        heading: "Bookings and calendars",
        paragraphs: [
          "To keep an owner's calendars in sync and work out commissions, we handle booking details that come from the listing sites through our channel manager, and from Nettimökki booking emails that owners forward to us. These contain the guest's name, dates, number of guests and the amount paid, and sometimes contact details the site shares. We use them only to block dates, show the bookings to the owner and bill our commission.",
          "Legal basis: providing the service to the owner (6(1)(b)) and our legitimate interest in preventing double bookings (6(1)(f)). If you booked a cottage as a guest, the listing site and the owner are responsible for the booking itself, and their own privacy policies apply to it.",
        ],
      },
      {
        heading: "AI reply suggestions",
        paragraphs: [
          "Owners can ask for a suggested reply to a guest. Only when they press the button do we send the conversation (including the guest's name and messages) and the cottage's details to Anthropic, whose AI model writes a draft. The owner reads and edits the draft before anything is sent. No decisions about anyone are made automatically.",
          "Legal basis: our legitimate interest in helping owners answer guests quickly and well (6(1)(f)). Under its commercial terms, Anthropic does not use this data to train its models.",
        ],
      },
      {
        heading: "Visiting the website",
        paragraphs: [
          "Our servers record technical details of each request, such as IP address, time, page and browser type. We need them to keep the site running, stop abuse (for example, too many form submissions from one address) and fix errors. These logs are kept only briefly. On a first visit the site also looks up, on our own server, which country your IP address is in (using the internet registries' public lists of address ranges), so it opens in your country's language; that country isn't stored. Legal basis: our legitimate interest in a secure, working service (6(1)(f)).",
          "Some parts of the site load content straight from other services: maps from Google Maps (OpenStreetMap where Google Maps isn't available), nearby places and their pictures from Wikipedia, website icons through Google, and cottage photos from Unsplash. Your browser then contacts those services directly, so they see your IP address, as with any website. We don't send them anything else about you.",
        ],
      },
      {
        heading: "Who receives your data",
        paragraphs: [
          "Cottage owners see the questions and messages guests send them. We give data to authorities only when the law requires it.",
          "We don't sell personal data and we don't share it for advertising. We use these providers, who handle data on our behalf and only as we instruct:",
        ],
        list: [
          "Hetzner Online (Germany): servers in Helsinki, Finland, where our database and files are kept",
          "A transactional email service that delivers our emails (sign-in codes, messages and notifications)",
          "Stripe: invoices and payments for owners",
          "Anthropic: AI reply drafts, only when an owner asks for one",
          "Beds24: the channel manager that connects owners' calendars and listings to the listing sites",
          "Listing sites such as Airbnb, Booking.com and Vrbo: they receive the cottage listing and calendar from us and send us booking details. They decide for themselves how they use guest data.",
        ],
      },
      {
        heading: "Transfers outside the EU",
        paragraphs: [
          "We keep our data in the EU. Anthropic and Stripe may process data in the United States. When that happens, the transfer is protected by the EU–US Data Privacy Framework or by the European Commission's standard contractual clauses, together with the providers' own security measures. The same applies if any other provider processes data outside the EU or EEA. Ask us if you'd like to know more about these safeguards.",
        ],
      },
      {
        heading: "How long we keep data",
        paragraphs: ["We keep data only as long as we need it:"],
        list: [
          "Guest conversations: up to 24 months after the last message, then deleted",
          "Newsletter: until you unsubscribe; unconfirmed sign-ups 30 days",
          "Sign-ups from owners who don't become customers: up to 24 months after our last contact",
          "Owner accounts, cottages and bookings: while the owner agreement runs, and up to 12 months after it ends",
          "Invoices and other accounting records: six years from the end of the financial year, as Finnish accounting law requires",
          "Server logs: a short time, normally a few weeks",
        ],
      },
      {
        heading: "Cookies and browser storage",
        paragraphs: [
          "We don't use analytics, advertising or tracking cookies, and we don't follow you around other websites. We only store what the site needs to work and what you choose yourself.",
          "You can delete cookies and stored data in your browser settings at any time. The site still works, but you may need to pick your language again or sign in again.",
          "What we store:",
        ],
        list: [
          "stugora_lang cookie: the language you picked, for a year. It's set only when you pick a language.",
          "sessionid cookie: keeps a cottage owner signed in, for up to 30 days or until they sign out",
          "csrftoken cookie: a security cookie that stops other websites from sending forms in your name",
          "Your browser's local storage: the currency you picked, the cottages you saved, and cached exchange rates, homepage photos and nearby places so pages load faster. This stays on your device; we don't receive it.",
          "The browser tab's session storage: whether you're signed in as an owner, so the menu shows the right link",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          `To use any of these rights, email ${CONTACT_EMAIL}. We may ask you to confirm who you are before we act.`,
          "You have the right to:",
        ],
        list: [
          "see the personal data we have about you and get a copy",
          "correct details that are wrong",
          "have your data deleted when we no longer need it or have no basis to keep it",
          "restrict how we use it, or object to use based on our legitimate interest",
          "get the data you gave us in a machine-readable format and take it elsewhere",
          "withdraw your consent at any time; this doesn't affect what was done before",
        ],
      },
      {
        heading: "Complaints",
        paragraphs: [
          "If you think we handle your data wrongly, please tell us first and we'll try to put it right. You can also complain to the Office of the Data Protection Ombudsman in Finland (tietosuoja.fi), or to the data protection authority in the EU country where you live.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "When we change this policy, we update the date at the top. If a change matters for you as an owner, we'll also tell you by email.",
        ],
      },
    ],
  },

  terms: {
    title: "Website terms",
    description: "The terms for using rantio.fi: what the site is, how bookings work and what we're responsible for.",
    updated: UPDATED,
    intro: "These terms apply when you use rantio.fi. We've kept them short and plain. By using the site, you accept them.",
    sections: [
      {
        heading: "Who runs Rantio",
        paragraphs: [
          `Rantio is a trading name of Elda-Auto Tmi, a Finnish sole proprietorship (business ID 2565459-6, VAT FI25654596). You can reach us at ${CONTACT_EMAIL}.`,
          "Rantio lists Nordic and Baltic holiday cottages on Airbnb, Booking.com, Vrbo and other sites on behalf of their owners. On rantio.fi you can browse the cottages, see where each one can be booked and send the owner a question.",
        ],
      },
      {
        heading: "Booking and paying",
        paragraphs: [
          "You don't book or pay on rantio.fi. Bookings and payments happen on the listing sites, such as Airbnb, Booking.com or Vrbo, under that site's own terms, cancellation rules and privacy policy. The rental agreement is between you and the owner, made through that site; Rantio is not a party to it.",
          "Questions about a booking, a payment or a refund go to the site you booked on, or to the owner.",
        ],
      },
      {
        heading: "Cottage information",
        paragraphs: [
          "Owners give us the descriptions, photos, prices and other details of their cottages. We check them as well as we reasonably can, but we can't promise that every detail is correct or up to date. What the listing site shows when you book is what counts.",
          "Prices on rantio.fi are a guide. Prices in a currency other than the cottage's own are converted with the European Central Bank's reference rates and are estimates; the listing site shows the exact price.",
        ],
      },
      {
        heading: "Contacting an owner",
        paragraphs: [
          "The contact form is for questions about a cottage and a stay. We pass your message to the owner, who decides whether and how to answer. A question is not a booking. We can remove messages and block use of the form if these rules are broken.",
          "When you use the form:",
        ],
        list: [
          "Use your real name and an email address you read.",
          "Be polite, and write only about the cottage or your stay.",
          "Don't send advertising, spam or anything illegal, offensive or harmful.",
          "Don't send card numbers, passwords or other sensitive information.",
          "Keep your private conversation link to yourself; anyone who has it can read the conversation.",
        ],
      },
      {
        heading: "Owner accounts",
        paragraphs: [
          "Cottage owners can ask to join through the sign-up form; sending it doesn't commit you to anything. Owners sign in with a one-time code sent to their email, so keep your email account safe and don't share the codes.",
          "Our service for owners, including the yearly fee per cottage (€99, or SEK 1,080, NOK 1,030, DKK 740 or ISK 13,500 for a cottage in Sweden, Norway, Denmark or Iceland), the 12% commission on bookings from the channels Rantio adds (VAT is added to both) and invoicing through Stripe, is covered by a separate owner service agreement that we sign with each owner. Where that agreement says something different from these terms, the agreement applies.",
        ],
      },
      {
        heading: "Content on the site",
        paragraphs: [
          "The site's text, design and the Rantio name belong to us; cottage photos and descriptions belong to their owners or photographers. You're welcome to look around and share links, but don't copy listings in bulk, scrape the site or use it in a way that harms it or other people.",
        ],
      },
      {
        heading: "What we're responsible for",
        paragraphs: [
          "We do our best to keep rantio.fi available and its information right, but we offer the site as it is, and it can sometimes be down or contain mistakes.",
          "We're not responsible for the stay itself, for what owners or listing sites do, or for the content of other websites we link to. We're not liable for indirect losses, such as lost profit, caused by using the site.",
          "Nothing in these terms limits your rights under mandatory consumer protection law, or our liability for harm caused on purpose or through gross negligence.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "We may update these terms. The date at the top shows the latest version, and the version in force when you use the site applies.",
        ],
      },
      {
        heading: "Law and disputes",
        paragraphs: [
          "Finnish law applies to these terms. If something goes wrong, contact us first and we'll try to sort it out. A consumer can also get help from the Finnish consumer advisory service and take a dispute to the Consumer Disputes Board (kuluttajariita.fi), and keeps the protection of the mandatory consumer laws of their home country. Otherwise, disputes are settled in the Helsinki District Court.",
        ],
      },
    ],
  },
};
