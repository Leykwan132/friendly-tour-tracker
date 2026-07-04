import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeSelect } from "@/components/ThemeSelect";
import { DashboardPage } from "./pages/DashboardPage";
import { MatchesPage } from "./pages/MatchesPage";
import { PlayersPage } from "./pages/PlayersPage";
import type { Tab } from "./types";
import "./App.css";

const tabs: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Stats" },
  { id: "players", label: "Players" },
  { id: "matches", label: "Matches" },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  function handleDataChange() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <div className="app mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12 pb-12">
      <header className="app-header app-header-row">
        <h1>Dota 2 Tournament Tracker</h1>
        <ThemeSelect />
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as Tab)}
        className="gap-6"
      >
        <TabsList variant="line">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardPage refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="players">
          <PlayersPage refreshKey={refreshKey} onDataChange={handleDataChange} />
        </TabsContent>
        <TabsContent value="matches">
          <MatchesPage refreshKey={refreshKey} onDataChange={handleDataChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
