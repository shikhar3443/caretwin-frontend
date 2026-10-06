import WelcomeBanner from "@/components/Dashboard/Welcomebanner";
import UploadReport from "@/components/Dashboard/UploadReport";
import StartAIChat from "@/components/Dashboard/StartAIChat";
import SymptomCheckerCard from "@/components/Dashboard/SymptomChecker/SymptomCheckerCard";
import EmergencyCard from "@/components/Dashboard/EmergencyCard";
import HealthSummary from "@/components/Dashboard/HealthSummary";
import RecentActivity from "@/components/Dashboard/RecentActivity";
import FamilySnapshot from "@/components/Dashboard/FamilySnapshot";
import HealthChart from "@/components/Dashboard/HealthChart";
import { Stagger, StaggerItem } from "@/components/ui/Motion";

export const metadata = { title: "Overview" };

export default function DashboardPage() {
  return (
    <Stagger className="mx-auto w-full min-w-0 max-w-[1200px] space-y-6">
      <StaggerItem>
        <WelcomeBanner />
      </StaggerItem>

      <StaggerItem>
        <section className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UploadReport />
          <StartAIChat />
          <SymptomCheckerCard />
          <EmergencyCard />
        </section>
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <HealthSummary />
          <div className="space-y-5">
            <RecentActivity />
            <FamilySnapshot />
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <HealthChart />
      </StaggerItem>
    </Stagger>
  );
}
