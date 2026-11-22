"""Rebuild the isolated-ear study with Blender in background mode, using this folder's art."""
import bpy
import math
import random
import sys
from bisect import bisect_left
from pathlib import Path
import numpy as np

folder = Path(__file__).resolve().parent
art = folder / "art"
rng = random.Random(41276)
W, H = 960, 540
TAU = 2 * math.pi
N = 360
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "Independent ripe barley"
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 4
scene.cycles.use_denoising = False
scene.cycles.use_adaptive_sampling = False
scene.cycles.transparent_max_bounces = 40
scene.render.use_persistent_data = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 8
scene.render.resolution_x, scene.render.resolution_y = 1920,1080
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, N
scene.view_settings.view_transform = "Standard"
scene.render.dither_intensity = 0
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.compression = 8
scene.render.filepath = "//render/barley-"
bpy.context.preferences.filepaths.save_version = 0

camera = bpy.data.cameras.new("Fixed desktop framing")
cam = bpy.data.objects.new("Camera", camera)
scene.collection.objects.link(cam)
cam.location = (4.8, 2.7, 10)
camera.type, camera.ortho_scale = 'ORTHO',9.6
scene.camera = cam

def image_material(label, file, cutout):
    image = bpy.data.images.load(str(art/file))
    image.pack()
    material = bpy.data.materials.new(label)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    link = material.node_tree.links.new
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.extension = 'CLIP' if cutout else 'EXTEND'
    emit = nodes.new("ShaderNodeEmission")
    link(texture.outputs['Color'],emit.inputs[0])
    result = nodes.new("ShaderNodeOutputMaterial")
    if cutout:
        mask = nodes.new('ShaderNodeMixShader')
        link(texture.outputs['Alpha'], mask.inputs[0])
        link(nodes.new('ShaderNodeBsdfTransparent').outputs[0],mask.inputs[1])
        link(emit.outputs[0],mask.inputs[2])
        link(mask.outputs[0],result.inputs[0])
    else:
        link(emit.outputs[0],result.inputs[0])
    return material, image

def textured_grid(name, verts, uv, nx, ny, material):
    faces = []
    for row in range(ny):
        for col in range(nx):
            k = row*(nx+1)+col
            faces.append((k,k+nx+1,k+nx+2,k+1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    layer = mesh.uv_layers.new()
    for loop in mesh.loops:
        layer.data[loop.index].uv = uv[loop.vertex_index]
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj

plate, background = image_material('Static landscape and leaves','still-leaves.png',False)
plane_uv=[(-.005,1.005),(1.005,1.005),(-.005,-.005),(1.005,-.005)]
ground=textured_grid('Locked background',[(u*9.6,v*5.4,0) for u,v in plane_uv],plane_uv,1,1,plate)
ground.hide_select=True
sprites=[image_material(label, f'ear-{i}.png', True) for i,label in enumerate(('Upright ear','Arching ear','Heavy ear'))]
pixels=np.empty(len(background.pixels),dtype=np.float32)
background.pixels.foreach_get(pixels)
rgb=pixels.reshape(1080,1920,4)[::-1,:,:3]
luma=rgb.dot([.2126,.7152,.0722])

def interp(points, x):
    return float(np.interp(x, [p[0] for p in points], [p[1] for p in points]))
field_edge=[(0,279),(90,287),(310,315),(490,348),(570,374),(635,358),(750,337),(960,332)]
road_left=[(340,530),(373,567),(395,616),(415,633),(445,657),(478,695),(505,713),(540,744),(650,800)]
road_right=[(340,568),(373,608),(395,662),(415,683),(445,743),(478,807),(505,850),(540,874),(650,955)]
linen=[(255,71),(310,73),(396,77),(448,58),(485,37),(540,6)]
def planted(x,y):
    if x<interp(linen,y)+2: return False
    return x<interp(road_left,y)-3 or x>interp(road_right,y)+3

# Root, height in composition coordinates, silhouette, width multiplier and direction.
plants=[]
def plant(rx,ry,h,kind,wide,side):
    plants.append((rx,ry,h,kind,wide,side))
# The largest ears carry the silhouettes from the approved hand-contact area.
for args in [(46,486,150,1,1.02,1),(90,449,102,0,1.16,1),(138,545,139,1,.96,1),
             (181,536,143,2,.86,1),(192,594,145,2,1.04,1),(293,486,100,1,.91,1),
             (349,563,163,2,1.08,1),(489,592,117,2,1.02,1),(585,532,105,1,.96,1),
             (679,588,116,2,.95,1),(841,553,147,2,1.05,1),(946,525,127,0,.94,-1)]:
    plant(*args)
# Fill pockets behind those ears. Clearance is measured around the crowns, not the roots.
def crown(p):
    x,y,h,k,w,d=p
    return x+d*h*[.24,.40,.53][k]*w, y-.81*h
crowns=[(*crown(p),p[2]) for p in plants]
for _ in range(3600):
    x=rng.uniform(36,980)
    edge=interp(field_edge,x)
    top=rng.uniform(edge-5,535)
    dist=max(0,top-edge)
    h=(32+.39*dist+.0020*dist**2)*rng.uniform(.78,1.20)
    h=min(h,142)
    k=rng.randrange(3); side=-1 if rng.random()<.17 else 1
    wide=rng.uniform(.76,1.12)
    ry=top+h
    if not planted(x,ry) or x<interp(linen,min(ry,540))+4: continue
    p=(x,ry,h,k,wide,side)
    cx,cy=crown(p)
    if not planted(cx,cy) or cy<edge-7:continue
    if any(((cx-u)/(.235*(h+hh)+2))**2+((cy-v)/(.115*(h+hh)+1.8))**2<1 for u,v,hh in crowns):continue
    plants.append(p); crowns.append((cx,cy,h))
plants.sort(key=lambda p:p[1])

def smooth(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)

def leaf_edge(x,y,h):
    # Hide the bottom of a stem at a real blade edge on the static plate.
    if y>H+max(3,.20*h) or not(2<x<W-2):return y+1,0
    col=int(2*x); low=max(4,int(2*(y-.30*h)));high=min(1076,int(2*y))
    if high<=low:return y,0
    values=luma[low+2:high+2,col]-luma[low-2:high-2,col]
    row=low+int(np.argmax(values))
    gy=luma[row+2,col]-luma[row-2,col];gx=luma[row,col+2]-luma[row,col-2]
    return row/2, float(np.clip(-gx/max(.014,gy),-1.1,1.1))

def draw_ear(label, depth, plant, rng):
    rx,ry,h,kind,wide,direction=plant
    material,img=sprites[kind]
    ratio=img.size[0]/img.size[1]
    width=h*ratio*wide*1.12
    angle=rng.uniform(-.11,.09)
    neck=h*[.63,.66,.85][kind]
    neck_x=h*[.09,.18,.30][kind]*wide*direction
    base_x=[.048,.031,.034][kind]
    cutoff,slope=leaf_edge(rx,ry,h)
    if 1<rx<W-1 and 1<cutoff<H-1:
        r,g,b=rgb[int(2*cutoff),int(2*rx)]
        if b>.27*g or r>2.35*g: return False
    nx,ny=6,22
    verts=[];uv=[];bend=[];nod=[]
    z=.003+depth*.0005
    for row in range(ny+1):
        v=row/ny # Top -> bottom
        for col in range(nx+1):
            u=col/nx
            x=(u-base_x)*width*direction
            # Trim the geometry and UV together; remaining rooted stalk disappears behind a leaf.
            ylocal=max(h*(1-v),ry-cutoff-x*slope) if v>.65 else h*(1-v)
            vtex=ylocal/h
            localx=x*math.cos(angle)+ylocal*math.sin(angle)
            up=ylocal*math.cos(angle)-x*math.sin(angle)
            verts.append(((rx+localx)/100,(H-ry+up)/100,z))
            uv.append((u,vtex))
            stem_level=min(1,max(0,up/neck))
            # The seed head is carried as a rigid mass, including its drooping tip.
            crown_weight=smooth((x*direction-abs(neck_x)+.025*h)/(.12*h))
            k=stem_level+(1-stem_level)*crown_weight
            anchor=neck*k*.50
            bend.append(((up-anchor)*k, -(localx-.5*neck_x*k)*k))
            nod.append(((up-neck)*crown_weight, -(localx-neck_x)*crown_weight))
    obj=textured_grid(f'{label} | {material.name}',verts,uv,nx,ny,material)
    obj.shape_key_add(name='Rest')
    # Wind arrives in loose groups; individual stem stiffness and return timing vary independently.
    phase=rx/1600 + rng.uniform(-.13,.13)+.12*math.sin(rx/135+ry/105)
    weight=rng.uniform(.067,.114)*(1.06 if kind==2 else .91)
    local=rng.uniform(0,TAU);lag=rng.uniform(.13,.31)
    for label,offsets,delay,strength in [('Stem bends from root',bend,0,weight),('Head settles',nod,lag,weight*.37)]:
        key=obj.shape_key_add(name=label);key.slider_min=-2;key.slider_max=2
        for i,(a,b) in enumerate(offsets):
            x,y,z=verts[i];key.data[i].co=(x+a*strength/100,y+b*strength/100,z)
        for frame in range(-11,N+14,4):
            t=TAU*(frame-1)/N
            p=t-phase-delay
            value=.77*math.sin(p)+.24*math.sin(2*p-.65)+.11*math.sin(3*t+local-delay)
            key.value=value
            key.keyframe_insert(data_path='value',frame=frame)
    return True

approved=[]
for idx,p in enumerate(plants):
    if draw_ear(f'{idx+1:03d}',idx,p,rng):
        approved.append(p)

def fill_gaps(originals):
    positions=random.Random(56719)
    motion=random.Random(93108)
    root_depths=[p[1] for p in plants]
    occupied=[(*crown(p),p[2]) for p in originals]
    # Match the approved distribution across the two fields and through depth.
    # Choose open pockets between existing heads while allowing overlapping stems.
    for number,parent in enumerate(originals,1):
        px,py,ph,*_=parent
        pockets=[]
        for trial in range(160):
            nearby=trial<120
            x=(min(W-12,max(12,px))+positions.uniform(-1.3,1.3)*ph
               if nearby else positions.uniform(48,W-12))
            h=ph*positions.uniform(.84,1.14)
            y=min(py,H-12+.81*h)+positions.uniform(-.36,.36)*ph
            kind=positions.randrange(3)
            wide=positions.uniform(.76,1.12)
            direction=-1 if positions.random()<.17 else 1
            p=(x,y,h,kind,wide,direction)
            cx,cy=crown(p)
            if not (0<x<W and 4<cx<W-4 and interp(field_edge,cx)-5<cy<H-3):
                continue
            if not planted(x,y) or not planted(cx,cy):
                continue
            score=min(((cx-u)/(.24*(h+hh)+2))**2+((cy-v)/(.12*(h+hh)+2))**2
                      for u,v,hh in occupied)
            pockets.append((nearby,score,p))
        for _,_,p in sorted(pockets,reverse=True):
            depth=bisect_left(root_depths,p[1])-.5
            if draw_ear(f'Infill {number:03d}',depth+number*.0001,p,motion):
                occupied.append((*crown(p),p[2]))
                break
        else:
            raise ValueError(f'No suitable space near ear {number}')

gold_leaves='--gold-leaves' in sys.argv
double_density='--double-density' in sys.argv or gold_leaves
if double_density:
    fill_gaps(approved)
scene.frame_set(1)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
filename='individual-ears-dense.blend' if double_density else 'individual-ears.blend'
if gold_leaves:
    # Placement and trimming above use the approved leaf edges and root colors.
    # Swap only the texture used to render the finished field.
    gold=bpy.data.images.load(str(art/'still-leaves-gold.png'))
    gold.pack()
    plate.node_tree.nodes.get('Image Texture').image=gold
    filename='individual-ears-gold.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(folder/filename))
print(f'Placed {len(approved)*(2 if double_density else 1)} independent stalks')
