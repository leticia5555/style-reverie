import { LedeSkeleton, CardsSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <LedeSkeleton figures={3} />
      <CardsSkeleton cards={4} />
    </div>
  );
}
