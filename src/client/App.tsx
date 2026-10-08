import Header from "./components/Header";
import GameCanvas from "./components/Canvas";
import TradeNotifications from "./components/TradeNotifications";
import CityOnboarding from "./components/CityOnboarding";

function App() {
  return (
    <>
      <Header />
      <CityOnboarding>
        <GameCanvas />
        <TradeNotifications />
      </CityOnboarding>
    </>
  );
}

export default App;
