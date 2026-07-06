import Link from 'next/link'

const LAST_UPDATED = 'July 1, 2026'
const COMPANY = 'Kaltrix Agency'
const PRODUCT = 'KaltrixOS'
const EMAIL = 'kaltrix.ng@gmail.com'
const COUNTRY = 'Federal Republic of Nigeria'

export const metadata = {
  title: 'Terms of Service — KaltrixOS',
  description: 'Terms of Service for KaltrixOS, Africa\'s Business Operating System.',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-lg font-black text-ink mb-4">{title}</h2>
    <div className="space-y-3 text-inkMid text-sm leading-relaxed">{children}</div>
  </section>
)

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ivory font-sans">

      {/* Nav */}
      <nav className="glass border-b border-border shadow-card sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-base font-black text-ink tracking-tight">
            Kaltrix<span className="text-brand">OS</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="text-inkFaint hover:text-ink transition font-medium">Privacy Policy</Link>
            <Link href="/signup" className="gradient-brand text-white font-black px-4 py-2 rounded-lg text-xs transition shadow-brand">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="mb-12">
          <p className="text-brand text-xs font-black uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-black text-ink mb-4">Terms of Service</h1>
          <p className="text-inkFaint text-sm">
            Last updated: {LAST_UPDATED} · Effective immediately for all new users
          </p>
          <div className="mt-6 bg-brandBg border border-brand/20 rounded-xl p-4 text-sm text-inkMid">
            Please read these Terms carefully before using {PRODUCT}. By creating an account or using our platform,
            you agree to be bound by these Terms. If you do not agree, do not use the platform.
          </div>
        </div>

        <Section title="1. Who We Are">
          <p>
            {PRODUCT} is a product of {COMPANY}, a business registered in the {COUNTRY}.
            We provide an online platform that helps African businesses create verified profiles,
            build trust with customers, and manage operations including bookings, invoicing, and customer relationships.
          </p>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-brand hover:underline font-medium">{EMAIL}</a>.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>You must be at least 18 years old to use {PRODUCT}. By using the platform, you represent that:</p>
          <ul className="list-none space-y-2 pl-4">
            {[
              'You are at least 18 years of age',
              'You have the legal capacity to enter into a binding agreement',
              'You are using the platform for legitimate business purposes',
              'The information you provide is accurate and up to date',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brand mt-0.5 flex-shrink-0">—</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="3. Your Account">
          <p>
            When you create an account, you are responsible for maintaining the security of your credentials.
            You must not share your password with anyone or allow others to access your account.
          </p>
          <p>
            You are responsible for all activity that occurs under your account. Notify us immediately at{' '}
            <a href={`mailto:${EMAIL}`} className="text-brand hover:underline">{EMAIL}</a>{' '}
            if you suspect unauthorized access.
          </p>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms,
            provide false information, or engage in fraudulent activity.
          </p>
        </Section>

        <Section title="4. Business Profiles and TrustScore">
          <p>
            {PRODUCT} allows businesses to create public profiles that appear on our Discover page.
            By creating a profile, you grant {COMPANY} a non-exclusive, royalty-free license to display
            your business information, logo, and description on the platform.
          </p>
          <p>
            The <strong className="text-ink">TrustScore</strong> is calculated automatically by our AI engine
            based on the completeness and quality of your business profile. It is a platform metric and does not
            constitute a guarantee, endorsement, or certification of your business by {COMPANY}.
          </p>
          <p>
            You are solely responsible for the accuracy of your business information. Providing false or
            misleading information — including fake reviews or inflated credentials — may result in
            immediate account termination.
          </p>
          <p>
            We reserve the right to adjust, recalculate, or remove TrustScores at any time without notice.
          </p>
        </Section>

        <Section title="5. Subscriptions and Payments">
          <p>
            {PRODUCT} offers paid subscription plans (Growth and Pro) billed on a 6-month or annual basis.
            Payments are processed securely through Paystack. By subscribing, you authorize us to charge
            your selected payment method for the plan amount.
          </p>
          <p>
            <strong className="text-ink">Refund Policy:</strong> All subscription payments are non-refundable
            once processed, except where required by applicable Nigerian law. If you believe you were charged
            in error, contact us within 7 days at{' '}
            <a href={`mailto:${EMAIL}`} className="text-brand hover:underline">{EMAIL}</a>.
          </p>
          <p>
            Subscription plans automatically expire at the end of the billing period. There is no automatic
            renewal — you will need to manually renew to continue accessing premium features.
            Your data remains safe and accessible on the Free plan after expiry.
          </p>
          <p>
            We reserve the right to change pricing with 30 days notice to existing subscribers.
          </p>
        </Section>

        <Section title="6. Acceptable Use">
          <p>You agree not to use {PRODUCT} to:</p>
          <ul className="list-none space-y-2 pl-4">
            {[
              'Impersonate another business or person',
              'Post false, misleading, or defamatory content',
              'Engage in spam, phishing, or unsolicited messaging',
              'Scrape, copy, or resell platform data without permission',
              'Violate any applicable Nigerian or international law',
              'Attempt to gain unauthorized access to other accounts or our systems',
              'Use the platform to facilitate illegal transactions or money laundering',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5 flex-shrink-0">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="7. Reviews and User Content">
          <p>
            Customers may leave reviews on business profiles. By submitting a review, you grant {COMPANY}
            a perpetual, royalty-free license to display that review on the platform.
          </p>
          <p>
            Reviews must be honest and based on genuine experience. We reserve the right to remove
            reviews that are fake, abusive, or violate these Terms. We do not verify the authenticity
            of reviews and are not liable for their content.
          </p>
          <p>
            Business owners may not post fake reviews for their own businesses or request reviews in
            exchange for incentives. Violation may result in account termination.
          </p>
        </Section>

        <Section title="8. Messages and Communications">
          <p>
            The messaging feature allows customers to contact businesses through the platform.
            {COMPANY} does not read or monitor private messages except where required by law or to
            investigate abuse reports.
          </p>
          <p>
            You must not use the messaging system to send spam, harassment, or illegal content.
            We reserve the right to disable messaging for accounts that abuse this feature.
          </p>
        </Section>

        <Section title="9. Intellectual Property">
          <p>
            {PRODUCT}, the KaltrixOS name, logo, TrustScore system, and all platform content are the
            intellectual property of {COMPANY}. You may not copy, reproduce, or distribute any part
            of the platform without our written permission.
          </p>
          <p>
            You retain ownership of your business content (logos, descriptions, photos) uploaded to the
            platform. You grant us a license to display this content as part of the service.
          </p>
        </Section>

        <Section title="10. Disclaimers and Limitation of Liability">
          <p>
            {PRODUCT} is provided &quot;as is&quot; without warranties of any kind. We do not guarantee that
            the platform will be uninterrupted, error-free, or that it will meet your specific business requirements.
          </p>
          <p>
            {COMPANY} is not liable for any indirect, incidental, or consequential damages arising
            from your use of {PRODUCT}, including loss of revenue, customers, or data.
            Our total liability to you shall not exceed the amount you paid us in the 3 months
            preceding the claim.
          </p>
          <p>
            We are not responsible for the actions, content, or reliability of businesses listed on
            the platform. Always conduct your own due diligence before transacting with any business.
          </p>
        </Section>

        <Section title="11. Termination">
          <p>
            You may delete your account at any time by contacting us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-brand hover:underline">{EMAIL}</a>.
            Upon deletion, your business profile will be removed from Discover and your data
            will be deleted within 30 days, except where retention is required by law.
          </p>
          <p>
            We may suspend or terminate your account immediately if you violate these Terms,
            without refund of any subscription fees paid.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms are governed by the laws of the {COUNTRY}.
            Any disputes shall be resolved in the courts of the Federal Capital Territory, Abuja.
          </p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p>
            We may update these Terms from time to time. We will notify registered users by email
            at least 14 days before material changes take effect. Your continued use of the platform
            after that date constitutes acceptance of the updated Terms.
          </p>
        </Section>

        {/* Footer links */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-inkFaint text-xs">© 2026 {COMPANY}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-inkFaint">
            <Link href="/privacy" className="hover:text-ink transition">Privacy Policy</Link>
            <Link href="/" className="hover:text-ink transition">Home</Link>
            <a href={`mailto:${EMAIL}`} className="hover:text-ink transition">{EMAIL}</a>
          </div>
        </div>

      </div>
    </div>
  )
}
