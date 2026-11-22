"""Run in Blender to rebuild the combined 24-second desktop motion study."""
from pathlib import Path

import bpy

folder = Path(__file__).resolve().parent
hand_folder = folder.parent / "hand-only"
bpy.ops.wm.open_mainfile(filepath=str(hand_folder / "hand-only.blend"))
study = bpy.context.scene
strip = next(s for s in study.sequence_editor.strips if s.channel == 2)
poses = []
for frame in range(1, 241):
    study.frame_set(frame)
    t = strip.transform
    poses.append((t.offset_x, t.offset_y, t.rotation))

bpy.ops.wm.open_mainfile(filepath=str(folder.parent / "individual-barley" / "individual-ears-clear.blend"))
scene = bpy.context.scene
scene.frame_end = 720
for obj in scene.objects:
    keys = getattr(obj.data, "shape_keys", None)
    if not keys:
        continue
    anim = keys.animation_data
    action, slot = anim.action, anim.action_slot
    track = anim.nla_tracks.new()
    repeat = track.strips.new("Two field cycles", 1, action)
    repeat.action_slot = slot
    repeat.action_frame_start, repeat.action_frame_end = 1, 361
    repeat.frame_start = 1
    repeat.repeat = 2
    anim.action = None

# The source hand was animated around the centre of a 3840px-wide strip.
# Match the existing orthographic field camera and put the fingers among the near ears.
width = scene.camera.data.ortho_scale
height = width * 2160 / 3840
bpy.ops.mesh.primitive_plane_add(size=2)
hand = bpy.context.object
hand.name = "Farmer's grazing hand"
# Keep the strip's registration point at the image centre, but trim off the
# transparent canvas so rays through the distant field never encounter the arm.
for vertex in hand.data.vertices:
    if vertex.co.x > 0:
        vertex.co.x = 2 * 1240/3840 - 1
    if vertex.co.y < 0:
        vertex.co.y = 1 - 2 * 1856/2160
for loop in hand.data.loops:
    x, y, _ = hand.data.vertices[loop.vertex_index].co
    hand.data.uv_layers.active.data[loop.index].uv = ((x+1)/2, (y+1)/2)
hand.scale = (width / 2, height / 2, 1)
material = bpy.data.materials["Upright ear"].copy()
material.name = "Illustrated arm"
texture = material.node_tree.nodes.get("Image Texture")
texture.image = bpy.data.images.load(str(hand_folder / "arm.png"))
texture.image.pack()
hand.data.materials.append(material)
for frame in range(1, 722):
    x, y, angle = poses[(frame - 1) % len(poses)]
    hand.location = (width/2 + x*width/3840, height/2 + y*height/2160, 1.1675)
    hand.rotation_euler.z = angle
    hand.keyframe_insert(data_path="location", frame=frame, group="Approved hand motion")
    hand.keyframe_insert(data_path="rotation_euler", index=2, frame=frame, group="Approved hand motion")
scene.name = "Homecoming"
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(folder / "homecoming.blend"))
