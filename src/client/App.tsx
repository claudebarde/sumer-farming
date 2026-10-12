import Header from "./components/Header";
import GameCanvas from "./components/Canvas";
import TradeNotifications from "./components/TradeNotifications";
import CityOnboarding from "./components/CityOnboarding";
import IsometricTest from "./components/IsometricTest";
import IsometricFarm from "./components/IsometricFarm";

function App() {
  return (
    <>
      <Header />
      {new URLSearchParams(window.location.search).get("view") === "isometric" ? <IsometricTest /> : new URLSearchParams(window.location.search).get("view") === "isometric-farm" ? <CityOnboarding><IsometricFarm /></CityOnboarding> : <CityOnboarding>
        <GameCanvas />
        <TradeNotifications />
      </CityOnboarding>}
    </>
  );
}

export default App;
