import FormPage from '@/components/ui/FormPage'
import FeedbackForm from '@/components/FeedbackForm'

export const metadata = { title: 'Send feedback — KaltrixOS' }

export default function DashboardFeedbackPage() {
  return (
    <FormPage
      title="Send feedback"
      description="You are one of our first businesses. Tell us what to fix, build or keep. It goes straight to the team."
    >
      <FeedbackForm variant="business" />
    </FormPage>
  )
}
