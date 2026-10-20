import FormPageSkeleton from '@/components/ui/FormPageSkeleton'

// Shown while this route is being fetched during navigation; the same skeleton
// continues through the plan-access check, so the form appears without a flash.
export default function Loading() {
  return <FormPageSkeleton sections={3} />
}
