import brewingJar from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewery-left-bottom-jar.png";
import fullBeerJars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-full-isometric.png";
import emptyBeerJars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-empty-isometric.png";

export default function MarketJarIcon({ itemKey }: { itemKey: "brewingVessels" | "emptyBeerJar" | "beer" }) {
  // Frame the artwork, not the vessel export's large transparent canvas margins.
  return itemKey === "brewingVessels"
    ? <svg width={48} height={48} viewBox="370 445 192 192" aria-hidden="true" focusable="false">
      <image href={brewingJar} width={1024} height={1024} />
    </svg>
    : <img src={itemKey === "beer" ? fullBeerJars : emptyBeerJars} alt="" width={48} height={48} />;
}
