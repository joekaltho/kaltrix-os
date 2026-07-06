import Link from 'next/link'

const LAST_UPDATED = 'July 1, 2026'
const COMPANY = 'Kaltrix Agency'
const PRODUCT = 'KaltrixOS'
const EMAIL = 'kaltrix.ng@gmail.com'

export const metadata = {
  title: 'Privacy Policy — KaltrixOS',
  description: 'Privacy Policy for KaltrixOS, Africa\'s Business Operating System.',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-lg font-black text-ink mb-4">{title}</h2>
    <div className="space-y-3 text-inkMid text-sm leading-relaxed">{children}</div>
  </section>
)

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ivory font-sans">

      {/* Nav */}
      <nav className="glass border-b border-border shadow-card sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-base font-black text-ink tracking-tight">
            Kaltrix<span className="text-brand">OS</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-inkFaint hover:text-ink transition font-medium">Terms of Service</Link>
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
          <h1 className="text-3xl sm:text-4xl font-black text-ink mb-4">Privacy Policy</h1>
          <p className="text-inkFaint text-sm">
            Last updated: {LAST_UPDATED}
          </p>
          <div className="mt-6 bg-brandBg border border-brand/20 rounded-xl p-4 text-sm text-inkMid">
            Your privacy matters to us. This policy explains what data we collect, how we use it,
            and your rights. We do not sell your personal data to third parties.
          </div>
        </div>

        <Section title="1. Who This Policy Applies To">
          <p>
            This Privacy Policy applies to all users of {PRODUCT} — including business owners who create
            profiles, customers who interact with those profiles, and visitors to our platform.
          </p>
          <p>
            This policy is maintained by {COMPANY}. If you have questions, contact us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-brand hover:underline font-medium">{EMAIL}</a>.
          </p>
        </Section>

        <Section title="2. What Data We Collect">
          <p>We collect the following categories of data:</p>

          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div>
              <p className="font-bold text-ink text-sm mb-1">Account Data</p>
              <p>Name, email address, password (encrypted), and account role when you register.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-bold text-ink text-sm mb-1">Business Profile Data</p>
              <p>Business name, industry, city, phone number, website URL, description, and logo — provided by you when creating a profile.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-bold text-ink text-sm mb-1">Operational Data</p>
              <p>Bookings, customer records, invoices, and messages created within your dashboard. This data belongs to you.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-bold text-ink text-sm mb-1">Payment Data</p>
              <p>Subscription plan and status. We do not store card numbers or bank details — these are handled directly by Paystack.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-bold text-ink text-sm mb-1">Usage Data</p>
              <p>Pages visited, features used, and general platform activity to help us improve {PRODUCT}.</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="font-bold text-ink text-sm mb-1">Customer Messages</p>
              <p>Messages sent to businesses through the platform contact form, including sender name, phone, and message content.</p>
            </div>
          </div>
        </Section>

        <Section title="3. How We Use Your Data">
          <p>We use your data only to provide and improve {PRODUCT}. Specifically:</p>
          <ul className="list-none space-y-2 pl-4">
            {[
              'To create and manage your account',
              'To display your business profile on the Discover page',
              'To calculate and update your TrustScore',
              'To process subscription payments via Paystack',
              'To deliver messages from customers to your inbox',
              'To send important account and product updates by email',
              'To improve platform features based on usage patterns',
              'To comply with applicable Nigerian law',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brand mt-0.5 flex-shrink-0">—</span>
                {item}
              </li>
            ))}
          </ul>
          <p>
            We do not use your data for advertising and we do not sell it to third parties.
          </p>
        </Section>

        <Section title="4. Public Information">
          <p>
            When you create a business profile, the following information becomes publicly visible on {PRODUCT}:
          </p>
          <ul className="list-none space-y-1.5 pl-4">
            {[
              'Business name, industry, city',
              'Business description and logo',
              'TrustScore and verification status',
              'Phone number and website URL',
              'Customer reviews',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-inkFaint mt-0.5 flex-shrink-0">·</span>
                {item}
              </li>
            ))}
          </ul>
          <p>
            Your email address, password, and internal operational data (bookings, invoices, CRM) are never made public.
          </p>
        </Section>

        <Section title="5. Data Sharing">
          <p>We share your data with the following parties only where necessary:</p>

          <div className="bg-surface rounded-xl border border-border divide-y divide-border">
            {[
              { party: 'Supabase', reason: 'Database and authentication infrastructure. Data is stored on servers in the EU/US region.' },
              { party: 'Paystack', reason: 'Payment processing for subscription plans. They handle all card data under their own PCI-DSS compliance.' },
              { party: 'Law Enforcement', reason: 'We may disclose data if required to do so by Nigerian law or a valid court order.' },
            ].map(item => (
              <div key={item.party} className="px-4 py-3">
                <p className="font-bold text-ink text-sm">{item.party}</p>
                <p className="text-inkFaint text-xs mt-0.5">{item.reason}</p>
              </div>
            ))}
          </div>

          <p>We do not share your data with advertisers, data brokers, or any other third parties.</p>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your account data for as long as your account is active. If you delete your account,
            we will delete your personal data within 30 days, except where we are required by law to retain it longer.
          </p>
          <p>
            Public reviews left by customers on your profile may remain on the platform after account deletion
            as they form part of the platform&apos;s public record. We will remove identifying information from them upon request.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the following rights regarding your personal data:</p>
          <ul className="list-none space-y-2 pl-4">
            {[
              { right: 'Access', desc: 'Request a copy of the personal data we hold about you.' },
              { right: 'Correction', desc: 'Update inaccurate or incomplete data through your profile settings.' },
              { right: 'Deletion', desc: 'Request deletion of your account and personal data.' },
              { right: 'Portability', desc: 'Request an export of your data in a readable format.' },
              { right: 'Objection', desc: 'Object to how we process your data in certain circumstances.' },
            ].map(item => (
              <li key={item.right} className="flex items-start gap-2">
                <span className="text-brand mt-0.5 flex-shrink-0 font-bold">—</span>
                <span><strong className="text-ink">{item.right}:</strong> {item.desc}</span>
              </li>
            ))}
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-brand hover:underline font-medium">{EMAIL}</a>.
            We will respond within 14 business days.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            {PRODUCT} uses cookies and similar technologies to maintain your session and improve
            your experience. We use:
          </p>
          <ul className="list-none space-y-2 pl-4">
            {[
              { type: 'Session cookies', desc: 'To keep you logged in while using the platform.' },
              { type: 'Preference cookies', desc: 'To remember your settings.' },
              { type: 'Analytics cookies', desc: 'To understand how the platform is used (aggregated, not personal).' },
            ].map(item => (
              <li key={item.type} className="flex items-start gap-2">
                <span className="text-inkFaint mt-0.5 flex-shrink-0">·</span>
                <span><strong className="text-ink">{item.type}:</strong> {item.desc}</span>
              </li>
            ))}
          </ul>
          <p>
            You can disable cookies in your browser settings, but this may affect platform functionality.
          </p>
        </Section>

        <Section title="9. Security">
          <p>
            We take data security seriously. Your data is stored in a secure database with row-level
            security enabled — meaning each user can only access their own data. Passwords are never
            stored in plain text.
          </p>
          <p>
            No system is 100% secure. We encourage you to use a strong, unique password and to
            contact us immediately if you suspect unauthorized access to your account.
          </p>
        </Section>

        <Section title="10. Children">
          <p>
            {PRODUCT} is not intended for use by anyone under 18 years of age. We do not knowingly
            collect data from minors. If you believe a minor has registered, contact us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-brand hover:underline">{EMAIL}</a>{' '}
            and we will delete the account promptly.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify registered users by
            email before material changes take effect. The &quot;Last updated&quot; date at the top of this
            page reflects when the policy was last revised.
          </p>
        </Section>

        {/* Footer links */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-inkFaint text-xs">© 2026 {COMPANY}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-inkFaint">
            <Link href="/terms" className="hover:text-ink transition">Terms of Service</Link>
            <Link href="/" className="hover:text-ink transition">Home</Link>
            <a href={`mailto:${EMAIL}`} className="hover:text-ink transition">{EMAIL}</a>
          </div>
        </div>

      </div>
    </div>
  )
}
