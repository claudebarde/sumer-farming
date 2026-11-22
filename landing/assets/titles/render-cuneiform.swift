import Foundation
import CoreText
import CoreGraphics
import ImageIO
let folder = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let fontURL = folder.appendingPathComponent("CuneiformComposite.ttf")
let font = CTFontCreateWithGraphicsFont(CGFont(CGDataProvider(url:fontURL as CFURL)!)!, 190, nil,nil)
let title = "𒀀𒊮 𒆠𒂗𒄀𒊏"
let line = CTLineCreateWithAttributedString(NSAttributedString(string:title,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font]))
let letters = CGMutablePath()
for run in CTLineGetGlyphRuns(line) as! [CTRun] {
 let face = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
 print(CTFontCopyPostScriptName(face))
 precondition(CTFontCopyPostScriptName(face) as String == CTFontCopyPostScriptName(font) as String)
 let n = CTRunGetGlyphCount(run)
 var glyphs=[CGGlyph](repeating:0,count:n), positions=[CGPoint](repeating:.zero,count:n)
 CTRunGetGlyphs(run,CFRange(),&glyphs); CTRunGetPositions(run,CFRange(),&positions)
 print(glyphs)
 for (id,p) in zip(glyphs,positions) {
  precondition(id != 0)
  if let path = CTFontCreatePathForGlyph(face,id,nil){letters.addPath(path,transform:CGAffineTransform(translationX:p.x,y:p.y))}
 }
}
let b=letters.boundingBoxOfPath
let scale:CGFloat=2, pad:CGFloat=12
let w=Int(ceil((b.width+2*pad)*scale)), h=Int(ceil((b.height+2*pad+3)*scale))
let cs=CGColorSpace(name:CGColorSpace.sRGB)!
let c=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,space:cs,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
c.scaleBy(x:scale,y:scale); c.translateBy(x:pad-b.minX,y:pad+3-b.minY)
func color(_ hex:Int)->CGColor {
 CGColor(srgbRed:CGFloat(hex>>16)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1)
}
func layer(_ width:CGFloat,_ down:CGFloat,_ hex:Int) {
 c.saveGState(); c.translateBy(x:0,y:-down); c.addPath(letters); c.setLineJoin(.round);c.setLineWidth(width);c.setFillColor(color(hex));c.setStrokeColor(color(hex)); c.drawPath(using:.fillStroke);c.restoreGState()
}
layer(16,2.7,0x432107);layer(9,1.2,0x71360a);layer(3.2,0.9,0xac590b);layer(1.4,0,0xf7ae38)
c.addPath(letters);c.clip()
let grad=CGGradient(colorsSpace:cs,colors:[color(0xffe6aa),color(0xffce78),color(0xffb333),color(0xf3991b)] as CFArray,locations:[0,0.28,0.78,1])!
c.drawLinearGradient(grad,start:CGPoint(x:0,y:b.maxY),end:CGPoint(x:0,y:b.minY),options:[])
c.saveGState();c.translateBy(x:0,y:-1.4);c.addPath(letters);c.setStrokeColor(color(0xffe8ad));c.setLineWidth(1.1);c.strokePath();c.restoreGState()
let out = folder.appendingPathComponent("fields-of-sumer-cuneiform.png")
let writer=CGImageDestinationCreateWithURL(out as CFURL,"public.png" as CFString,1,nil)!
CGImageDestinationAddImage(writer,c.makeImage()!,nil);precondition(CGImageDestinationFinalize(writer))
print(w,h)
