"""Run inside Blender to revise the approved gold loop and save a separate scene."""
from pathlib import Path

import bpy
import numpy as np

folder = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(folder / 'individual-ears-gold.blend'))
scene = bpy.context.scene
ears = [obj for obj in scene.objects if obj.type == 'MESH' and obj.data.shape_keys]

# The two field edges traced on the 960 x 540 background, including its near bend.
road = np.array([
    (355, 561, 574), (362, 550, 573), (373, 535, 569), (379, 539, 572),
    (385, 549, 587), (395, 583, 624), (405, 609, 649), (415, 629, 670),
    (428, 643, 688), (450, 651, 711), (465, 660, 736), (480, 677, 757),
    (500, 691, 782), (520, 709, 804), (540, 725, 825),
])

def positions(key):
    coords = np.empty(len(key.data) * 3, dtype=np.float32)
    key.data.foreach_get('co', coords)
    return coords.reshape(-1, 3)[:, :2]

def reaches_path(ear):
    rest, bend, nod = ear.data.shape_keys.key_blocks
    xy = positions(rest)
    # Each channel is a sum of sines bounded by 1.12. Include interpolation
    # headroom and the full swept mesh, including movement between frames.
    travel = 1.15 * (np.abs(positions(bend) - xy) + np.abs(positions(nod) - xy))
    lo = (xy - travel) * 100
    hi = (xy + travel) * 100
    # Each grid face stays inside this AABB even when both shape keys deform it.
    polygons = np.array([face.vertices[:] for face in ear.data.polygons])
    left, bottom = lo[polygons].min(axis=1).T
    right, top = hi[polygons].max(axis=1).T
    first = np.maximum(540 - top, road[0, 0])
    last = np.minimum(540 - bottom, 540)
    # Test the swept box against each linear segment of the path.
    for (y0, l0, r0), (y1, l1, r1) in zip(road, road[1:]):
        a = np.maximum(first, y0)
        b = np.minimum(last, y1)
        near_left = np.minimum(l0+(l1-l0)*(a-y0)/(y1-y0), l0+(l1-l0)*(b-y0)/(y1-y0))
        far_right = np.maximum(r0+(r1-r0)*(a-y0)/(y1-y0), r0+(r1-r0)*(b-y0)/(y1-y0))
        if np.any((a <= b) & (right >= near_left-1) & (left <= far_right+1)):
            return True
    return False

removed = 0
retained = []
for ear in sorted(ears, key=lambda obj: obj.data.vertices[0].co.z):
    if reaches_path(ear):
        bpy.data.objects.remove(ear, do_unlink=True)
        removed += 1
    else:
        retained.append(ear)

# Separate overlapping cutouts in their existing paint order. The orthographic
# camera preserves their screen positions and scale when only depth changes.
for index, ear in enumerate(retained, 1):
    ear.location.z = .005 * index - ear.data.vertices[0].co.z

scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'individual-ears-clear.blend'))
print(f'Path clearance removed {removed} ears and retained {len(retained)}.')
