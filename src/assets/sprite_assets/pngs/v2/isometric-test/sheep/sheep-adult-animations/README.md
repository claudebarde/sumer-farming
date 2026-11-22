# Adult sheep animation artwork

Generated with the built-in image generation tool on 2026-11-15. These are review assets; no gameplay or scene wiring is enabled.

## Organisation

Keep all sheep-related assets under the parent `sheep/` folder: approved pen and idle adult at its root, adult animation frames here, and future lamb, growing/sheared sheep, wool and meat assets in this same asset family when created. Those future assets are not included yet.

## Frame contract

- `sheep-adult-walk-01.png` through `08`: looping walk. Start with the gazelle timing of 120 ms/frame for wandering, then review at pen scale.
- `sheep-adult-lower-01.png` through `08`: idle to grazing. Frame 01 is an exact copy of the approved idle sprite. Start with 140 ms/frame; reverse for raising the head.
- `sheep-adult-chew-01.png` through `04`: grazing loop, initially 220 ms/frame. Derived from lower-08.
- All frames use the complete 1254 × 1254 transparent canvas. Keep a shared origin and scale; do not individually trim or fit each frame.
- Face left by default; mirror the set for rightward travel. Match movement to isometric routes as with the gazelles.
- Reuse the existing farmer/gazelle texture preparation and linear filtering when integrating. Do not independently sharpen each view.
- Visual review in the pen is still required for stride, head transitions, scale, foot registration, and avoiding overlap between animals. Generated intermediate poses may need refinement once played in sequence.
- Grazing is cosmetic and does not replace barley feeding.

## Generation prompts

Walking and lowering input: `../sheep-adult-idle-test.png` (edit target). Chewing input: `sheep-adult-lower-08.png` (edit target). Every call requested a transparent background.

### sheep-adult-walk-01

Edit this approved sheep into walking animation frame 01 of 08. Single full-body sprite on transparent background. Preserve identical square canvas, sheep body position, size, wool, brown face, floppy ears, broad fat tail, lighting and camera. Only articulate legs: slow quadruped walk facing left; near front leg reaches forward to left for contact, far front leg behind, near hind leg back, far hind leg forward. Anatomically natural straight cloven hooves, four legs only, subtle stride, body stationary for in-place walk. No shadow, no scenery, no text.

### sheep-adult-walk-02

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Walking frame 2/8 for a slow in-place sheep walking LEFT. Keep head and body fixed; only legs articulate, mild natural stride. Early support: near front slightly forward planted, far front begins lifting forward under chest; near hind pushes back, far hind bears weight. No sideways sliding or twisted feet.

### sheep-adult-walk-03

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Walking frame 3/8 for a slow in-place sheep walking LEFT. Keep head and body fixed; only legs articulate, mild natural stride. Passing: near front beneath shoulder bearing weight, far front bent swinging forward; near hind lifted passing beneath rump, far hind planted. No sideways sliding or twisted feet.

### sheep-adult-walk-04

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Walking frame 4/8 for a slow in-place sheep walking LEFT. Keep head and body fixed; only legs articulate, mild natural stride. Late passing: near front moves back planted, far front reaches forward lowered; near hind swings forward, far hind begins pushing back. No sideways sliding or twisted feet.

### sheep-adult-walk-05

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Walking frame 5/8 for a slow in-place sheep walking LEFT. Keep head and body fixed; only legs articulate, mild natural stride. Opposite contact: far front forward planted, near front behind; near hind forward planted, far hind behind. No sideways sliding or twisted feet.

### sheep-adult-walk-06

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Walking frame 6/8 for a slow in-place sheep walking LEFT. Keep head and body fixed; only legs articulate, mild natural stride. Opposite early support: far front slightly forward planted, near front starts lifting forward under chest; far hind pushes back, near hind bears weight. No sideways sliding or twisted feet.

### sheep-adult-walk-07

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Walking frame 7/8 for a slow in-place sheep walking LEFT. Keep head and body fixed; only legs articulate, mild natural stride. Opposite passing: far front beneath shoulder bearing weight, near front bent swinging forward; far hind lifted passing beneath rump, near hind planted. No sideways sliding or twisted feet.

### sheep-adult-walk-08

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Walking frame 8/8 for a slow in-place sheep walking LEFT. Keep head and body fixed; only legs articulate, mild natural stride. Return toward first contact: far front back planted, near front reaches forward lowered; far hind swings forward, near hind begins pushing back. No sideways sliding or twisted feet.

### sheep-adult-lower-02

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Grazing transition frame 2/8. All four legs stay planted EXACTLY as idle. Keep torso, rump, fat tail, and legs unchanged. Lower and extend ONLY neck/head gradually toward ground at screen-left. This is 14% of movement from upright idle to nose almost touching ground beside front hooves. Head angle tilts down 11 degrees relative to idle. Nose approaches floor but does not penetrate it; ears hang naturally. Smooth intermediate pose, do not change whole animal scale to fit.

### sheep-adult-lower-03

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Grazing transition frame 3/8. All four legs stay planted EXACTLY as idle. Keep torso, rump, fat tail, and legs unchanged. Lower and extend ONLY neck/head gradually toward ground at screen-left. This is 29% of movement from upright idle to nose almost touching ground beside front hooves. Head angle tilts down 23 degrees relative to idle. Nose approaches floor but does not penetrate it; ears hang naturally. Smooth intermediate pose, do not change whole animal scale to fit.

### sheep-adult-lower-04

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Grazing transition frame 4/8. All four legs stay planted EXACTLY as idle. Keep torso, rump, fat tail, and legs unchanged. Lower and extend ONLY neck/head gradually toward ground at screen-left. This is 43% of movement from upright idle to nose almost touching ground beside front hooves. Head angle tilts down 34 degrees relative to idle. Nose approaches floor but does not penetrate it; ears hang naturally. Smooth intermediate pose, do not change whole animal scale to fit.

### sheep-adult-lower-05

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Grazing transition frame 5/8. All four legs stay planted EXACTLY as idle. Keep torso, rump, fat tail, and legs unchanged. Lower and extend ONLY neck/head gradually toward ground at screen-left. This is 57% of movement from upright idle to nose almost touching ground beside front hooves. Head angle tilts down 46 degrees relative to idle. Nose approaches floor but does not penetrate it; ears hang naturally. Smooth intermediate pose, do not change whole animal scale to fit.

### sheep-adult-lower-06

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Grazing transition frame 6/8. All four legs stay planted EXACTLY as idle. Keep torso, rump, fat tail, and legs unchanged. Lower and extend ONLY neck/head gradually toward ground at screen-left. This is 71% of movement from upright idle to nose almost touching ground beside front hooves. Head angle tilts down 57 degrees relative to idle. Nose approaches floor but does not penetrate it; ears hang naturally. Smooth intermediate pose, do not change whole animal scale to fit.

### sheep-adult-lower-07

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Grazing transition frame 7/8. All four legs stay planted EXACTLY as idle. Keep torso, rump, fat tail, and legs unchanged. Lower and extend ONLY neck/head gradually toward ground at screen-left. This is 86% of movement from upright idle to nose almost touching ground beside front hooves. Head angle tilts down 69 degrees relative to idle. Nose approaches floor but does not penetrate it; ears hang naturally. Smooth intermediate pose, do not change whole animal scale to fit.

### sheep-adult-lower-08

Use case: precise-object-edit. Single sheep animation sprite. Edit the approved idle sheep reference. Preserve EXACT canvas size, body position, body scale, camera angle, upper-left lighting, cream shaggy fleece, brown face and legs, drooping ears, hornless head and distinctive broad fat tail. Transparent background, no ground shadow, no text or props. Do not crop or recenter around the new pose. Four natural legs and cloven hooves only. Grazing transition frame 8/8. All four legs stay planted EXACTLY as idle. Keep torso, rump, fat tail, and legs unchanged. Lower and extend ONLY neck/head gradually toward ground at screen-left. This is 100% of movement from upright idle to nose almost touching ground beside front hooves. Head angle tilts down 80 degrees relative to idle. Nose approaches floor but does not penetrate it; ears hang naturally. Smooth intermediate pose, do not change whole animal scale to fit.

### sheep-adult-chew-01

Use case: precise-object-edit. Edit the supplied fully lowered grazing sheep into one chewing animation frame. Preserve the entire image exactly: canvas, fixed feet, body, tail, fleece pattern, low neck and head position, lighting, camera and scale. Change ONLY the tiny jaw/muzzle chewing gesture: mouth closed, relaxed neutral jaw. Subtle natural chewing, no wide open mouth, no tongue, no added grass. One full sheep sprite, transparent background, no shadow, no props or text. Do not raise the head or recenter the animal.

### sheep-adult-chew-02

Use case: precise-object-edit. Edit the supplied fully lowered grazing sheep into one chewing animation frame. Preserve the entire image exactly: canvas, fixed feet, body, tail, fleece pattern, low neck and head position, lighting, camera and scale. Change ONLY the tiny jaw/muzzle chewing gesture: lower jaw slightly open and shifted subtly toward viewer. Subtle natural chewing, no wide open mouth, no tongue, no added grass. One full sheep sprite, transparent background, no shadow, no props or text. Do not raise the head or recenter the animal.

### sheep-adult-chew-03

Use case: precise-object-edit. Edit the supplied fully lowered grazing sheep into one chewing animation frame. Preserve the entire image exactly: canvas, fixed feet, body, tail, fleece pattern, low neck and head position, lighting, camera and scale. Change ONLY the tiny jaw/muzzle chewing gesture: jaw closes slightly offset to the other side. Subtle natural chewing, no wide open mouth, no tongue, no added grass. One full sheep sprite, transparent background, no shadow, no props or text. Do not raise the head or recenter the animal.

### sheep-adult-chew-04

Use case: precise-object-edit. Edit the supplied fully lowered grazing sheep into one chewing animation frame. Preserve the entire image exactly: canvas, fixed feet, body, tail, fleece pattern, low neck and head position, lighting, camera and scale. Change ONLY the tiny jaw/muzzle chewing gesture: jaw returning toward center, mouth almost closed. Subtle natural chewing, no wide open mouth, no tongue, no added grass. One full sheep sprite, transparent background, no shadow, no props or text. Do not raise the head or recenter the animal.

