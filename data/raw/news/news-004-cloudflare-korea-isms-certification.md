---
id: news-004
title: "Localizing compliance at scale: Achieving South Korea’s ISMS certification"
source: Cloudflare Blog
url: https://blog.cloudflare.com/k-isms/
published_date: 2026-10-22
source_type: primary
---

For ten days, auditors appointed by the Korea Internet & Security Agency (KISA) sat together with us and worked through 80 controls. That is what it took for a company headquartered in the United States, operating a global network serving Korean users, to be certified in South Korea. Cloudflare has now obtained South Korea's Information Security Management System (ISMS) certification under the ISMS-P framework.

For customers in Korea, this is more than a compliance checkbox. It is evidence that Cloudflare's security and privacy program has been examined not only for whether our controls exist, but for how they operate in the context of Korean law, the Korean language, and the particular expectations of Korean regulators.

What a Korean user sees when they sign up

The most visible result of this work is the Cloudflare account sign-up page. In most parts of the world, the line that sits above the sign-up button reads: "By continuing, I agree to Cloudflare's terms, privacy policy, and cookie policy."

A user signing up from South Korea sees something different. The Korean experience is triggered by the country selected at sign-up and by IP geolocation from within South Korea, and it breaks the same agreement into four separately labeled items, each marked required or optional, each linking to its full text, with an option to agree to all of them at once:

- 모두 동의 (Agree to all)

- [필수] 서비스 약관 ([Required] Terms of Service)

- [필수] 개인정보 수집 및 이용 ([Required] Collection and use of personal information)

- [필수] 제한된 범위의 개인정보 해외 이전 ([Required] Transfer of a limited amount of personal information overseas)

- [선택] 제한된 범위의 개인정보 제3자 제공 ([Optional] Sharing a limited amount of personal information with marketing third parties)

The three required items are hard gates. The sign-up button stays disabled until all three are checked, so there is no path through the form that creates an account without an affirmative action on each one. The optional item governs marketing permission only, and leaving it unchecked has no effect on the account creation (it merely opts the user out of receiving marketing communications).

The hard part: sign-up paths that never show a form

Itemizing consent on a form we control is straightforward. The difficulty was the sign-up paths that skip that form entirely.

Globally, you can create a Cloudflare account with Google, Apple, or GitHub. Those flows hand the user to an identity provider and return with an authenticated identity, and they never render our own sign-up form, which is precisely where the four consent items live. There is no step in that handoff where we can present three required items, link each to its full Korean text, and require an affirmative action on each before the account exists. The identity provider's screen is not ours to change.

We could either build a separate post-authentication consent gate for one country, or remove the paths that bypass the gate we already had. We chose the second. Social sign-up is not offered in South Korea, so every account created there goes through Cloudflare’s sign-up form, which enforces the required consents.
