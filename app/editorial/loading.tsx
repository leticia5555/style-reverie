import { LedeSkeleton, RowsSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <LedeSkeleton figures={3} />
      <RowsSkeleton rows={9} />
    </div>
  );
}
