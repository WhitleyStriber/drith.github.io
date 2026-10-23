"""Stand up a fully armed Drith base and save it as one .blend for render.py.

blender -b --factory-startup --python armed_base.py -- out.blend

The pieces and where they go are drith-godot's own: the hull, tower and plinths
off oumo_mini.cpp's PIECES, the hardpoints off SLOT_DEFS in drith_base.cpp
(Godot metres, slab top at 0, front toward -Z). Godot (x, y, z) is Blender
(x, -z, y). Each gun stands with the bottom of its mesh on its slot.
"""
import bpy, sys, os
from mathutils import Vector

M = os.path.expanduser("~/Documents/gamemodels/models")
out = sys.argv[sys.argv.index("--") + 1]


def g2b(x, y, z):
    return Vector((x, -z, y))


def append(rel):
    path = os.path.join(M, rel)
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    objs = []
    for o in dst.objects:
        if o is None or o.type not in {"MESH", "EMPTY"}:
            continue
        if "convcolonly" in o.name or o.name.startswith("Col_") or "-col" in o.name:
            continue
        bpy.context.scene.collection.objects.link(o)
        objs.append(o)
    bpy.context.view_layer.update()
    return objs


def bounds(objs):
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi


def roots(objs):
    s = set(objs)
    return [o for o in objs if o.parent not in s]


def place_at(objs, at):
    """Model origin onto `at` (a built piece: hull, tower, plinth)."""
    for o in roots(objs):
        o.location += at
    bpy.context.view_layer.update()


def stand_on(objs, foot, yaw=0.0):
    """Mesh's bottom-centre onto `foot` (a gun on its hardpoint)."""
    lo, hi = bounds(objs)
    shift = foot - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for o in roots(objs):
        o.location += shift
        o.rotation_euler.z += yaw
    bpy.context.view_layer.update()


for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

# No slab: render.py's shadow catcher stands in for the ground, and the
# foundation's dark top swallows the frame.
hull = append("Drith/Drith_01/Drith_01.blend")
place_at(hull, g2b(0, 0.05, 0))
# Drith_Tower is left off: out of the game's runtime it is a bare light frame
# over the roof, and in a still it reads as a rendering fault.
for x, z in ((-7.0, -7.4), (7.0, -7.4), (-7.0, 7.4), (7.0, 7.4)):
    place_at(append("Drith/Mount/Drith_Mount_Plinth.blend"), g2b(x, 0.05, z))

PLINTH_TOP = 0.05 + 0.25
_, hull_hi = bounds([o for o in hull if o.name == "Drith"] or hull)
roof = hull_hi.z

# MAIN: the Main Battery off each flank, 2.5 over the hull's floor.
for x in (-8.3, 8.3):
    stand_on(append("Turrets/MainBattery_01/MainBattery_01.blend"), g2b(x, 0.05 + 2.5, 0))
# FRONT pair on the forward plinths, BACK pair on the rear ones.
for x in (-7.0, 7.0):
    stand_on(append("Turrets/PlasmaCannon_01/PlasmaCannon_01.blend"), g2b(x, PLINTH_TOP, -7.4))
    stand_on(append("Turrets/Flamethrower_01/Flamethrower_01.blend"), g2b(x, PLINTH_TOP, 7.4))
# Roof: the radar dead centre, the silo kind (here the Howitzer) beside it.
stand_on(append("Radar/RD_01/RD_01.blend"), Vector((0, 0, roof)))
stand_on(append("Howitzer/HW_01/HW_01.blend"), Vector((-2.4, 0, roof)))

bpy.ops.wm.save_as_mainfile(filepath=out)
print("SAVED", out, "roof", round(roof, 2))
