const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

# FinnTrack — Legal Pack

**Operator:** Rian Rayani
**Contact:** contact@finntrack.net
**Audience:** children, including children under 13 — full COPPA compliance required
**Model:** paid service

**Read this first.** These are drafts prepared for a student project. I am not a lawyer and this is not legal advice. They are written conservatively and cover the issues that genuinely apply to a paid money-tracking app used by children under 13. They will meaningfully reduce your risk. They cannot guarantee you won't face a legal problem. Charging money for a children's service raises the stakes — an attorney review before public launch is genuinely worth it now.

**One thing that got easier by charging money.** COPPA treats a payment transaction that notifies the account holder as an approved method of verifiable parental consent. Because a parent must pay by card to activate an account, **the payment itself becomes your consent mechanism** — stronger and simpler than the email-based method you'd otherwise need. That's built into the documents below.

**Blanks to fill in, marked `[LIKE THIS]`:**

1. **Mailing address** — COPPA requires the operator's physical address. School, program, or PO box; not a home address.
2. **Pricing model** — subscription or one-time purchase, the price, and the billing period.
3. **Free trial**, if you offer one, and its length.
4. **Refund window** — I've drafted 14 days; change it if you prefer.
5. **Launch date** on each document.
6. **Providers** — Base44, your backend/database, and your payment processor (Stripe, Paddle, etc.).

---

## PART 1 — Terms of Service

**FinnTrack Terms of Service**
**Last updated: `[DATE]`**

### 1. About these Terms

These Terms of Service ("Terms") are a legal agreement between you and Rian Rayani ("FinnTrack," "we," "us," or "our"), the operator of the FinnTrack website and application (the "Service").

By using or paying for the Service, you agree to these Terms. If you do not agree, do not use the Service.

**FinnTrack is designed for children.** If you are under 18, you may use the Service only with the permission and supervision of a parent or legal guardian. If you are under 13, a parent or legal guardian must provide verifiable consent before you may use the Service, as described in our Privacy Policy.

**Only a parent or legal guardian aged 18 or over may purchase the Service.** By purchasing, a parent or guardian agrees to these Terms on the child's behalf, confirms they are the authorised holder of the payment method used, and accepts responsibility for the child's use of the Service.

### 2. What FinnTrack is — and what it is not

FinnTrack is an **educational tool**. It lets a user manually type in amounts of money they say they spent or received, assign each entry a category, and view summaries of what they entered.

**FinnTrack is not:**

- a bank, credit union, money transmitter, or financial institution of any kind;
- a payment service — it cannot send, receive, hold, store, or transfer a user's money;
- linked to any real bank account, debit card, credit card, savings account, or payment method belonging to the child;
- a source of financial, investment, tax, accounting, or legal advice;
- a system of record for any real financial account.

**No real money is tracked or moved by the Service.** The only money involved is the subscription or purchase price a parent pays us for access. Beyond that, no funds move through the Service, and no real financial account can be connected to it. Every number displayed in FinnTrack was typed in manually by a user and has not been verified against any bank, card, or financial institution. Figures may be inaccurate, incomplete, or entirely invented. Nothing in the Service should be relied upon for any financial decision.

The categories used in the Service — "necessity," "want," "asset," and "liability" — are **simplified educational labels** intended to teach general concepts to young people. They are not formal accounting definitions and must not be used for accounting, tax, or business purposes.

### 3. Eligibility, accounts, and parental consent

Children under 13 may use the Service only after a parent or legal guardian has provided verifiable consent through the process described in our Privacy Policy. Accounts created without that consent will not be activated and will be deleted.

**Children may not make purchases.** All payments must be made by a parent or legal guardian aged 18 or over using a payment method they are authorised to use. We do not knowingly accept payment from a child. If a purchase is made without the payment method holder's authorisation, contact us at contact@finntrack.net and we will cancel the subscription and refund the most recent charge.

You are responsible for activity that occurs under your account. Do not share login details with anyone other than your parent or guardian. Contact us immediately at contact@finntrack.net if you believe someone else has accessed the account.

We may refuse, suspend, or terminate any account at any time, including where we believe parental consent has not been validly given or has been withdrawn.

### 4. Acceptable use — what you must not enter or do

**Do not enter real names, account numbers, card numbers, passwords, home addresses, phone numbers, or any other sensitive personal information anywhere in the Service, including in the optional note field.** FinnTrack does not need this information, and you should never type it in.

You also agree not to:

- enter information about other people, including their names, financial details, or contact information;
- enter content that is unlawful, harassing, hateful, threatening, sexually explicit, or otherwise inappropriate for a service used by children;
- use the Service for any unlawful purpose;
- attempt to access another user's account or data;
- probe, scan, disrupt, overload, reverse engineer, or interfere with the Service or its infrastructure;
- use bots, scrapers, or other automated systems to access the Service;
- copy, resell, sublicense, or commercially exploit the Service without our written permission.

We may remove content that violates this section, and may suspend or delete accounts that do.

### 5. Prices, payment, and billing

**Price.** Access to the Service costs `[PRICE]` per `[BILLING PERIOD]`. `[If one-time: Access to the Service costs [PRICE] as a one-time purchase.]` Prices are in US dollars and exclude any applicable taxes, which will be added where required by law.

**Payment processing.** Payments are processed by `[PAYMENT PROCESSOR]`. We do not receive or store full card numbers. Your payment details are handled by the processor under its own terms and privacy policy.

**Free trial.** `[If offered: We offer a [LENGTH] free trial. Unless cancelled before the trial ends, the subscription automatically begins and the payment method on file is charged. If not offered, delete this paragraph.]`

**Automatic renewal.** `[If subscription:]` Subscriptions renew automatically at the end of each billing period, and the payment method on file is charged the then-current price, until cancelled. **You may cancel at any time** from your account settings or by emailing contact@finntrack.net. Cancellation takes effect at the end of the current billing period; access continues until then. We will send a reminder before each renewal where required by law.

**Price changes.** We may change prices. We will give at least 30 days' notice before a change affects an existing subscription, and the change will take effect at the next renewal. If you do not accept the new price, cancel before it takes effect.

**Refunds.** If you are not satisfied, contact contact@finntrack.net within `[14]` days of a charge and we will refund it in full. Beyond that window, refunds are at our discretion, except where a refund is required by law. If we terminate an account for a reason other than a breach of these Terms, we will refund the unused portion of the current billing period.

**Failed payments.** If a payment fails, we may suspend access until payment succeeds, and may close the account if payment is not resolved within a reasonable period. Data is retained during suspension and deleted in line with Section 8 of our Privacy Policy once the account is closed.

### 6. Your content

You keep ownership of the entries created in the account ("Your Content"). You grant us a limited, non-exclusive licence to store, process, and display Your Content solely to operate the Service for you.

We do not sell Your Content. We do not use Your Content for advertising. We do not use Your Content to build profiles about users. We share it only as described in the Privacy Policy.

### 7. Availability, changes, and data loss

We may change, improve, suspend, limit, or discontinue features of the Service. If we permanently discontinue the Service or materially reduce what a paid subscription provides, we will give reasonable notice and refund the unused portion of any prepaid period.

**Keep your own records.** We do not guarantee that data will be preserved, backed up, or recoverable. Data may be lost through technical failure, service changes, or account deletion. Do not rely on FinnTrack as your only record of anything important. `[Recommended: offer an export function, so this clause is fair as well as protective.]`

### 8. Third-party services

The Service is hosted and supported by third-party providers, including `[Base44, your backend/database provider, and PAYMENT PROCESSOR]`. Their handling of data is governed by their own terms and privacy policies. We are not responsible for the acts or omissions of third-party providers.

### 9. Disclaimer of warranties

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT.

WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY CALCULATION OR SUMMARY IT DISPLAYS IS ACCURATE.

Nothing in this section affects any statutory rights a consumer has that cannot lawfully be excluded.

### 10. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, RIAN RAYANI AND ANY CONTRIBUTORS TO THE SERVICE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, PROFITS, SAVINGS, OR GOODWILL, ARISING OUT OF OR RELATING TO USE OF THE SERVICE.

OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNT PAID TO US FOR THE SERVICE IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B) FIFTY US DOLLARS (US$50.00).

Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you. Nothing in these Terms limits liability that cannot lawfully be limited, including liability for fraud.

### 11. Indemnification

You agree to indemnify and hold harmless Rian Rayani from any claims, damages, losses, and reasonable legal fees arising out of misuse of the Service or violation of these Terms or of any law. A parent or guardian who purchases the Service accepts this obligation in respect of the child's use.

### 12. Termination

You may cancel at any time as described in Section 5. A parent or guardian may request deletion of a child's account and data at any time by emailing contact@finntrack.net. We may suspend or terminate access at any time; where we do so for a reason other than a breach of these Terms, we will refund the unused portion of the current billing period. Sections 4, 6, 9, 10, 11, and 13 survive termination.

### 13. Governing law and disputes

These Terms are governed by the laws of the State of California, without regard to conflict-of-law rules. Any dispute will be brought exclusively in the state or federal courts located in San Diego County, California, and you consent to that jurisdiction. Nothing here prevents a consumer from bringing a claim in small claims court.

### 14. Changes to these Terms

We may update these Terms. If we make material changes, we will update the "Last updated" date and notify parents at the contact details we hold, at least 30 days before changes affecting price or a subscription take effect. Where the law requires it, we will obtain fresh parental consent. Continued use after changes means the updated Terms are accepted.

### 15. Contact

Rian Rayani — FinnTrack
contact@finntrack.net
`[MAILING ADDRESS]`

---

## PART 2 — Privacy Policy

**FinnTrack Privacy Policy**
**Last updated: `[DATE]`**

FinnTrack is made for kids, so we collect as little information as we possibly can. This policy explains exactly what we collect, why, and what rights parents have. It is written to comply with the Children's Online Privacy Protection Act (COPPA).

### 1. Who we are

FinnTrack is operated by Rian Rayani. Contact us at contact@finntrack.net or `[MAILING ADDRESS]`.

### 2. Information we collect

**From the child:**

| What | Why |
|---|---|
| A display name or username the child chooses (we ask that this **not** be their full real name) | To save and reload their entries |
| A login credential (password) | To keep their entries private to them |
| Transaction entries: an amount, a category, a date, and an optional short note | This is the core function of the app |

**From the parent or guardian:**

| What | Why |
|---|---|
| Email address **or** phone number | To obtain and verify parental consent, to let parents exercise their rights, and to send billing notices |
| Payment information, handled by our payment processor | To take payment for the Service and to verify parental consent |

**We do not collect from the child:** their email address, their phone number, their full legal name, their home address, their date of birth, their precise location, photographs, videos, audio, contacts, social media profiles, government identifiers, payment information, or persistent identifiers used for advertising.

**We do not store full payment card numbers.** Payment is processed by `[PAYMENT PROCESSOR]`, which handles card details under its own terms. We receive only limited information such as the last four digits, card type, billing status, and whether a payment succeeded.

**No child financial accounts.** FinnTrack is not connected to any bank or payment system belonging to a child. Every number a child enters in the app is typed in manually and is not verified against anything real.

**Automatically collected technical information:** our hosting providers may log basic technical data such as IP address, browser type, and timestamps, for security and to keep the Service running. This is used only for internal operation and security, never to build profiles or to advertise. `[Confirm what your host actually logs and update this line before publishing.]`

**Sensitive information in the note field:** we instruct users not to enter real names, account numbers, addresses, or other personal details in the optional note field, and we display this warning in the app. If you become aware that such information has been entered, contact us and we will delete it.

### 3. How we use information

We use information only to:

- create and maintain a child's account;
- save, display, and summarize the entries the child creates;
- obtain and verify parental consent;
- process payment, prevent fraudulent charges, and send billing and renewal notices;
- communicate with parents about the account;
- keep the Service secure and prevent misuse;
- comply with law, including tax and accounting obligations.

**We do not** sell personal information, rent or trade it, use it for advertising of any kind, use it to build advertising or behavioral profiles, or permit third parties to use it for their own purposes.

### 4. No advertising

FinnTrack contains **no advertising** and **no third-party advertising, behavioral tracking, or profiling technology**. We do not permit any third party to collect personal information from users of the Service for advertising purposes. The Service is funded by subscription, not by advertising.

### 5. Who we share information with

We share information only with:

- **Service providers** who host and operate the app on our behalf (`[Base44 and your backend/database provider]`), and only to the extent needed to run the Service;
- **Our payment processor** (`[PAYMENT PROCESSOR]`), to take and manage payments from parents;
- **Legal authorities**, where required by law, legal process, or to protect the safety of a child or another person;
- **A parent or guardian**, exercising the rights described in Section 6.

None of these providers is permitted to use children's personal information for their own purposes. We do not disclose children's personal information to anyone else.

### 6. Children's privacy and parental rights (COPPA)

FinnTrack knowingly collects personal information from children under 13 and complies with COPPA.

- **Notice.** We give parents direct notice of what we collect and how we use it before collecting personal information from a child.
- **Verifiable parental consent.** We obtain verifiable consent from a parent or guardian before a child's account is activated. Our method is described in Section 7.
- **Data minimization.** We collect only what is reasonably necessary for a child to use the Service, and we never condition a child's participation on disclosing more information than is necessary.
- **No third-party disclosure.** We do not disclose children's personal information to third parties other than the service providers listed in Section 5.
- **Retention limits.** We keep a child's information only as long as needed to provide the Service. We delete it when an account is closed, and we delete accounts inactive for 12 months.
- **No advertising or profiling.** We never use children's information for advertising, profiling, or behavioral targeting.

**Parental rights.** A parent or guardian may at any time:

1. **review** the personal information we have collected from their child;
2. **request deletion** of their child's personal information;
3. **refuse to permit further collection or use** of their child's information (this generally means the account will be closed and the subscription cancelled);
4. **withdraw consent** previously given.

To exercise any of these rights, email **contact@finntrack.net** from the email address associated with the account, or write to `[MAILING ADDRESS]`. We may need to verify your identity first, so that we do not release a child's information to the wrong person. We respond within 30 days. Withdrawing consent or requesting deletion also cancels any ongoing subscription; we will refund the unused portion of the current billing period.

### 7. How we obtain verifiable parental consent

A child's account is activated only after a parent or guardian completes a payment for the Service using a credit or debit card in their own name. The payment transaction provides notification to the account holder, and serves as our method of verifiable parental consent.

The process is:

1. At signup, we collect a parent's email address or phone number. No child account is activated at this stage.
2. We send the parent the direct notice set out in Part 3, describing exactly what we collect from the child and how it is used.
3. The parent completes payment through `[PAYMENT PROCESSOR]` using a card they are authorised to use, and confirms consent.
4. We send a confirmation of the transaction and of the consent given to the parent's contact details.
5. The child's account is then activated.

If consent and payment are not completed, we delete any information collected during signup.

A parent may withdraw consent at any time by emailing contact@finntrack.net.

### 8. Data retention

We keep entries for as long as the account is active. When an account is deleted or consent is withdrawn, we delete the associated personal information within 30 days, except for limited billing and transaction records we are required to retain for tax and accounting purposes, which contain no child data. Accounts inactive for 12 months are deleted automatically.

### 9. Security

We use reasonable measures to protect information, including encrypted connections (HTTPS), password hashing handled by our authentication provider, access controls limiting who on our team can reach the production database, and a managed database provider. Card details are handled by our payment processor and are not stored on our systems. No online service can be completely secure, and we cannot guarantee absolute security. Please do not enter sensitive personal information into FinnTrack.

### 10. Where data is stored

Information is stored on servers operated by our providers, located in the United States. FinnTrack is intended for users in the United States. If you are outside the United States, additional laws may apply that this policy does not address.

### 11. California residents

California residents have rights under the CCPA/CPRA, including the right to know what personal information we collect, the right to delete it, the right to correct it, and the right not to be discriminated against for exercising these rights. **We do not sell or share personal information as those terms are defined under California law, and we never sell or share the personal information of anyone under 16.**

### 12. Changes to this policy

If we make a material change to how we handle personal information, we will update the "Last updated" date and notify parents at the contact details we hold. Where the law requires it, we will obtain new parental consent before the change takes effect for existing users.

### 13. Contact

Rian Rayani — FinnTrack
contact@finntrack.net
`[MAILING ADDRESS]`

---

## PART 3 — Direct Notice to Parents

*Send this to the parent before payment and before any child account is activated.*

**Before your child can use FinnTrack, we need your permission.**

FinnTrack is an educational app that helps young people practise tracking money. Your child types in amounts they say they spent or received, labels each one as a necessity, want, asset, or liability, and sees a monthly summary.

**FinnTrack is not a bank and does not touch your child's money.** It has no connection to any bank account, debit card, or payment system belonging to your child. Nothing your child enters moves any actual money. Every number in the app is typed in by hand. The only payment involved is the subscription you pay us for access.

**Cost:** `[PRICE]` per `[BILLING PERIOD]`. `[If applicable: This begins after a [LENGTH] free trial. It renews automatically until you cancel, and you can cancel at any time from your account settings or by emailing us.]`

**What we collect from your child:** a display name they choose (we ask them not to use their full real name), a password, and the entries they type in — an amount, a category, a date, and an optional short note.

**What we do not collect from your child:** their email address, phone number, full legal name, home address, date of birth, location, photos, contacts, or any real financial or card details.

**What we collect from you:** your email address or phone number, and your payment details, which are handled by our payment processor `[PAYMENT PROCESSOR]`. We never see or store your full card number.

**How we use it:** only to run the app for your child, to take payment, and to contact you about the account. FinnTrack shows no advertising, does not profile users, and never sells or shares personal information.

**Your rights.** At any time you may review your child's information, ask us to delete it, refuse any further collection, or withdraw your consent. Email **contact@finntrack.net** or write to `[MAILING ADDRESS]`. We respond within 30 days. Withdrawing consent also cancels your subscription, and we will refund the unused portion of the current period.

**To give consent:** complete the payment for your child's account using a card in your own name and confirm your consent at checkout. Completing that payment is how we verify that a parent, not a child, has approved this account. We will send you a confirmation.

Full Privacy Policy: `[https://finntrack.db.app/privacy]