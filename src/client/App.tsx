import Header from "./components/Header";
import TradeNotifications from "./components/TradeNotifications";
import CityOnboarding from "./components/CityOnboarding";
import IsometricFarm from "./components/IsometricFarm";

function App() {
  return (
    <>
      <Header />
      <CityOnboarding>
        <IsometricFarm />
        <TradeNotifications />
      </CityOnboarding>
    </>
  );
}

export default App;
