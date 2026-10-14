import Header from "./components/Header";
import GameCanvas from "./components/Canvas";
import TradeNotifications from "./components/TradeNotifications";
import CityOnboarding from "./components/CityOnboarding";
import IsometricTest from "./components/IsometricTest";
import IsometricFarm from "./components/IsometricFarm";

function App() {
  const view = new URLSearchParams(window.location.search).get("view");
  return (
    <>
      <Header />
      {view === "isometric" ? <IsometricTest /> : <CityOnboarding>
        {view === "isometric-farm" ? <IsometricFarm /> : <GameCanvas />}
        <TradeNotifications />
      </CityOnboarding>}
    </>
  );
}

export default App;
