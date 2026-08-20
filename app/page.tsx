import Leaderboard from "@/components/Leaderboard";
import { getListings } from "@/lib/data";
import { availablePaymentProviders } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { listings, demo } = await getListings();
  return <Leaderboard initialListings={listings} demo={demo} paymentProviders={availablePaymentProviders()} />;
}
