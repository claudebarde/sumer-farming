import brewingJar from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewery-left-bottom-jar.png";
import fullBeerJars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-full-isometric.png";
import emptyBeerJars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-empty-isometric.png";

export default function MarketJarIcon({ itemKey }: { itemKey: "brewingVessels" | "emptyBeerJar" | "beer" }) {
  // The vessel asset is now tightly cropped; contain its native aspect ratio.
  return itemKey === "brewingVessels"
    ? <img src={brewingJar} alt="" width={48} height={48} style={{ objectFit: "contain" }} />
    : <img src={itemKey === "beer" ? fullBeerJars : emptyBeerJars} alt="" width={48} height={48} />;
}
