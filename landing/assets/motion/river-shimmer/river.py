"""Build the river lighting pass on the approved desktop scene. Run with Blender."""
from pathlib import Path
import math

import bpy
import numpy as np

folder = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(folder.parent/'homecoming'/'homecoming.blend'))
scene = bpy.context.scene
plate = scene.objects['Locked background'].data.materials[0]
nodes = plate.node_tree.nodes
link = plate.node_tree.links.new
source = next(n for n in nodes if n.type == 'TEX_IMAGE')
emission = next(n for n in nodes if n.type == 'EMISSION')

# Coordinates measured on the 1080p painting. Each group spans a small
# column of existing highlights, between the bank and the nearest vegetation.
# Slightly different timings and response across each stroke break up synchrony.
groups = [
    # x, radius, first row, last row, cycles, phase
    (780, 26, 491, 515, 3, .34), (857, 34, 494, 523, 4, .76),
    (1242, 23, 509, 532, 3, .91), (1501, 45, 517, 562, 4, .14),
    (1628, 42, 523, 561, 3, .67), (1799, 46, 529, 573, 5, .42),
]
w,h = source.image.size
assert (w,h)==(1920,1080)
pixels = np.empty(w*h*4,np.float32)
source.image.pixels.foreach_get(pixels)
linear = pixels.reshape(h,w,4)[::-1,:,:3]
srgb = np.where(linear<=.0031308,12.92*linear,1.055*linear**(1/2.4)-.055)
lookup = np.zeros((h,w,4),np.float32)
lookup[:,:,3] = 1
def ease(v):
    v=np.clip(v,0,1)
    return v*v*(3-2*v)

for x,r,top,bottom,cycles,phase in groups:
    ys,xs=np.mgrid[top:bottom+1,x-r:x+r+1]
    dx=(xs-x)/r
    red,green,blue=srgb[ys,xs].transpose(2,0,1)
    # Red rises sharply on the painted cream/gold strokes against turquoise water.
    mask=ease((red-.20)/.42)*ease((green-.52)/.21)
    mask*=ease((1-np.abs(dx))/.38)*ease((ys-top)/3)*ease((bottom-ys)/3)
    # A soft crest moves along each mark; adjacent marks catch the light in succession.
    lookup[ys,xs,0]=(phase+.30*dx+.026*(ys-top)+.002*(xs-x)*np.sin(ys*.58))%1
    lookup[ys,xs,1]=mask
    lookup[ys,xs,2]=cycles/8

img=bpy.data.images.new('River reflection timing and mask',w,h,alpha=True,float_buffer=False,is_data=True)
img.colorspace_settings.name='Non-Color'
img.pixels.foreach_set(np.ascontiguousarray(lookup[::-1]).ravel())
img.pack()
timing=nodes.new('ShaderNodeTexImage')
timing.image=img
# Neighbouring paint marks can have quite different phases. Read their masks
# at the native painted resolution without interpolating wrapped phase values.
timing.interpolation='Closest'
timing.label='Painted reflections'
channels=nodes.new('ShaderNodeSeparateColor')
link(timing.outputs['Color'],channels.inputs[0])

def math_node(op,a,b=None,label=''):
    n=nodes.new('ShaderNodeMath')
    n.operation=op
    n.label=label
    for inp,v in zip(n.inputs,(a,b)):
        if v is None: continue
        if isinstance(v,(int,float)): inp.default_value=v
        else: link(v,inp)
    return n.outputs[0]

t=nodes.new('ShaderNodeValue')
t.label='24-second loop phase'
t.outputs[0].driver_add('default_value').driver.expression='((frame-1)%720)/720'
cycles=math_node('ROUND',math_node('MULTIPLY',channels.outputs[2],8))
phase=math_node('ADD',math_node('MULTIPLY',t.outputs[0],cycles),channels.outputs[0])
light=math_node('SINE',math_node('MULTIPLY',phase,2*math.pi))
def tint(base,color,strength,label):
    n=nodes.new('ShaderNodeMixRGB')
    n.label=label
    link(strength,n.inputs[0])
    link(base,n.inputs[1])
    n.inputs[2].default_value=(*color,1)
    return n.outputs[0]
def amount(sign,amplitude):
    crest=math_node('MAXIMUM',math_node('MULTIPLY',light,sign),0)
    return math_node('MULTIPLY',math_node('MULTIPLY',crest,crest),math_node('MULTIPLY',channels.outputs[1],amplitude))
quiet=tint(source.outputs['Color'],(.008,.35,.42),amount(-1,.69),'Reflection settles into the water')
warm=tint(quiet,(1.0,.92,.65),amount(1,.78),'Late-afternoon light')
link(warm,emission.inputs[0])
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'homecoming-river.blend'))
