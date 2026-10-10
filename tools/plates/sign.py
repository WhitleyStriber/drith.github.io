"""The devlog's sign: a wooden post driven into Dynamis, DEVLOG and an arrow down.

blender -b Dynamis_Arena.blend --python sign.py -- out.png key=val ...
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, Euler, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
out = argv[0]
opt = dict(a.split("=", 1) for a in argv[1:])
f = lambda k, d: float(opt.get(k, d))
sc = bpy.context.scene
random.seed(7)

for o in bpy.data.objects:
    if o.name.split("-")[0] in ("Shaft", "Corona") or o.name.endswith("-colonly"):
        o.hide_render = True

# --- where it stands ---------------------------------------------------------
SX, SY = f("sx", 4.0), f("sy", -118.0)
deps = bpy.context.evaluated_depsgraph_get()
ground = bpy.data.objects["Ground-col"]
def gz(x, y):
    hit, loc, n, i = ground.evaluated_get(deps).ray_cast(Vector((x, y, 500)), Vector((0, 0, -1)))
    return loc.z if hit else 0.0
GZ = gz(SX, SY)
print("GROUND", GZ)
FACE = math.radians(f("face", 180))        # yaw: which way the board looks (180 = south, -Y)

root = bpy.data.objects.new("Sign", None)
sc.collection.objects.link(root)
root.location = (SX, SY, GZ)
root.rotation_euler = Euler((math.radians(f("leanx", -2.5)), math.radians(f("leany", 3.0)), FACE + math.pi), 'XYZ')

# --- wood --------------------------------------------------------------------
def wood(name, base, dark, seed):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes.new; L = nt.links.new
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = N('ShaderNodeTexCoord')
    mp = N('ShaderNodeMapping'); mp.inputs["Scale"].default_value = (0.5, 16.0, 16.0)
    mp.inputs['Location'].default_value = (seed * 3.1, seed * 1.7, seed)
    L(tc.outputs['Object'], mp.inputs[0])
    nz = N('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 8.0
    nz.inputs['Roughness'].default_value = 0.62
    L(mp.outputs[0], nz.inputs[0])
    wv = N('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'
    wv.inputs['Scale'].default_value = 1.6; wv.inputs['Distortion'].default_value = 5.0
    wv.inputs['Detail'].default_value = 3.0; wv.inputs['Detail Scale'].default_value = 1.2
    L(mp.outputs[0], wv.inputs[0])
    mx = N('ShaderNodeMath'); mx.operation = 'MULTIPLY'
    L(nz.outputs[0], mx.inputs[0]); L(wv.outputs[0], mx.inputs[1])
    cr = N('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].position = 0.02; cr.color_ramp.elements[0].color = dark + (1,)
    cr.color_ramp.elements[1].position = 0.42; cr.color_ramp.elements[1].color = base + (1,)
    L(mx.outputs[0], cr.inputs[0])
    L(cr.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.82
    bp = N('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.55; bp.inputs['Distance'].default_value = 0.02
    L(mx.outputs[0], bp.inputs['Height']); L(bp.outputs[0], b.inputs['Normal'])
    return m

def flat(name, col, rough=0.6, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = col + (1,)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = col + (1,)
        b.inputs['Emission Strength'].default_value = emit
    return m

W_POST = wood("SignPost", (0.23, 0.15, 0.09), (0.07, 0.045, 0.03), 1.0)
W_PLANK = [wood("SignPlank%d" % i, c, (0.10, 0.06, 0.035), 2.0 + i * 1.3)
           for i, c in enumerate([(0.42, 0.29, 0.17), (0.36, 0.24, 0.14), (0.46, 0.32, 0.19)])]
PAINT = flat("SignPaint", (0.90, 0.86, 0.74), 0.7, emit=f("paint", 0.25))
IRON = flat("SignNail", (0.06, 0.06, 0.065), 0.45, 0.9)

def add(name, me, mat, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.012):
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.parent = root
    o.location = loc; o.rotation_euler = rot
    o.data.materials.append(mat)
    if bevel:
        bv = o.modifiers.new("Bevel", 'BEVEL'); bv.width = bevel; bv.segments = 2
    for p in o.data.polygons: p.use_smooth = False
    return o

def rough_box(name, sx, sy, sz, jitter=0.012, cuts=6):
    """A sawn timber: a box along local Z or X whose long edges wander a little."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    long_axis = max(range(3), key=lambda i: (sx, sy, sz)[i])
    edges = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co)[long_axis]) > 1e-4]
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=cuts)
    for v in bm.verts:
        for i in range(3):
            if i != long_axis:
                v.co[i] += random.uniform(-jitter, jitter)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me

# the post: 0.16 square, 3.1 long, 0.55 of it in the ground, top sawn to a point
POST_H = 2.55
post = add("Sign_Post", rough_box("Sign_Post", 0.17, 0.15, POST_H + 0.6, 0.008, 9), W_POST, (0, 0, (POST_H - 0.6) / 2))
# a pointed cap
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.125, radius2=0.0, depth=0.16)
bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(45), 3, 'Z'), verts=bm.verts)
me = bpy.data.meshes.new("Sign_Cap"); bm.to_mesh(me); bm.free()
add("Sign_Cap", me, W_POST, (0, 0, POST_H + 0.07), bevel=0)

# the board: three planks, each a touch off true
BW, PH, PT = 1.86, 0.27, 0.045
FRONT = -0.075 - PT / 2          # local -Y is the face
top_z = 2.28
planks = []
for i in range(3):
    w = BW + random.uniform(-0.09, 0.09)
    z = top_z - i * (PH + 0.012)
    o = add("Sign_Plank%d" % i, rough_box("Sign_Plank%d" % i, w, PT, PH, 0.006, 10), W_PLANK[i],
            (random.uniform(-0.03, 0.03), FRONT, z), (0, math.radians(random.uniform(-1.3, 1.3)), 0))
    planks.append(o)
    for sxn in (-0.045, 0.045):   # two nails into the post
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.017)
        bmesh.ops.scale(bm, vec=(1, 0.45, 1), verts=bm.verts)
        me = bpy.data.meshes.new("Sign_Nail"); bm.to_mesh(me); bm.free()
        n = add("Sign_Nail", me, IRON, (sxn, FRONT - PT / 2 - 0.002, z + random.uniform(-0.05, 0.05)), bevel=0)
        for p in n.data.polygons: p.use_smooth = True
board_mid = top_z - (PH + 0.012)

# DEVLOG, painted
font = bpy.data.fonts.load(opt.get("font", "/home/djt/.local/share/fonts/PTSansNarrow-Bold.ttf"))
cu = bpy.data.curves.new("Sign_Text", 'FONT')
cu.body = "DEVLOG"; cu.font = font
cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
cu.size = 0.80; cu.space_character = 1.08
cu.extrude = 0.004
txt = bpy.data.objects.new("Sign_Text", cu)
sc.collection.objects.link(txt)
txt.parent = root
txt.location = (0.0, FRONT - PT / 2 - 0.006, board_mid + 0.005)
txt.rotation_euler = (math.radians(90), 0, 0)
txt.data.materials.append(PAINT)
bpy.context.view_layer.update()
tw = txt.dimensions.x
k = (BW - 0.30) / tw
txt.scale = (k, min(k, 1.0) * f("texth", 1.0), 1)
print("TEXT", tw, k)

# the arrow: a plank cut to a point, nailed to the post under the board, pointing down
AW, AH, HEAD = 0.20, 1.02, 0.36
pts = [(-AW / 2, AH / 2), (AW / 2, AH / 2), (AW / 2, -AH / 2 + HEAD), (AW / 2 + 0.17, -AH / 2 + HEAD),
       (0, -AH / 2), (-AW / 2 - 0.17, -AH / 2 + HEAD), (-AW / 2, -AH / 2 + HEAD)]
bm = bmesh.new()
vs = [bm.verts.new((x, 0, z)) for x, z in pts]
face = bm.faces.new(vs)
r = bmesh.ops.extrude_face_region(bm, geom=[face])
bmesh.ops.translate(bm, vec=(0, PT, 0), verts=[e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Sign_Arrow"); bm.to_mesh(me); bm.free()
arrow_z = top_z - 2 * (PH + 0.012) - PH / 2 - 0.05 - AH / 2
arrow = add("Sign_Arrow", me, W_PLANK[1], (0.0, FRONT - PT / 2, arrow_z), (0, math.radians(-2.0), 0), bevel=0.008)
# its painted face: a stripe down the shaft and the head, inset
bm = bmesh.new()
ins = 0.04
y = -0.003
hz = -AH / 2 + HEAD
bm.faces.new([bm.verts.new(c) for c in ((-AW / 2 + ins, y, AH / 2 - ins), (-AW / 2 + ins, y, hz - 0.001), (AW / 2 - ins, y, hz - 0.001), (AW / 2 - ins, y, AH / 2 - ins))])
hw = AW / 2 + 0.17
bm.faces.new([bm.verts.new(c) for c in ((-hw + ins * 2.6, y, hz - ins), (0, y, -AH / 2 + ins * 2.0), (hw - ins * 2.6, y, hz - ins))])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Sign_ArrowPaint"); bm.to_mesh(me); bm.free()
ap = add("Sign_ArrowPaint", me, PAINT, (0, 0, 0), bevel=0)
ap.parent = arrow
for z in (AH / 2 - 0.10, -AH / 2 + HEAD + 0.12):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.017)
    bmesh.ops.scale(bm, vec=(1, 0.45, 1), verts=bm.verts)
    me = bpy.data.meshes.new("Sign_Nail"); bm.to_mesh(me); bm.free()
    n = add("Sign_Nail", me, IRON, (0, -0.004, z), bevel=0); n.parent = arrow

# --- camera ------------------------------------------------------------------
W, H = int(f("w", 2000)), int(f("h", 1250))
cam_d = bpy.data.cameras.new("SignCam"); cam = bpy.data.objects.new("SignCam", cam_d)
sc.collection.objects.link(cam)
cam_d.lens = f("lens", 32); cam_d.sensor_width = 36
az = FACE + math.radians(f("az", 14))      # round the sign from its face
dist = f("dist", 5.6)
tgt = Vector((SX, SY, GZ + f("th", 1.55))) + Vector((f("tx", 0), f("ty", 0), 0))
cx, cy = tgt.x + math.sin(az) * dist * -1, tgt.y + math.cos(az) * dist
cz = max(gz(cx, cy) + f("ch", 0.75), GZ + f("ch", 0.75))
cam.location = (cx, cy, cz)
cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_d.clip_start = 0.05; cam_d.clip_end = 3000
if f("fstop", 0) > 0:
    cam_d.dof.use_dof = True; cam_d.dof.focus_distance = dist; cam_d.dof.aperture_fstop = f("fstop", 2.8)
sc.camera = cam
print("CAM", tuple(cam.location), "TGT", tuple(tgt))

# --- the two lights the plates use, close in: gold on the face, ice behind ----
def lamp(name, kind, pos, energy, color, size, spot=None):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if kind == 'AREA': d.size = size
    else: d.shadow_soft_size = size
    if spot: d.spot_size = math.radians(spot); d.spot_blend = 0.8
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = (tgt - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    return o
side = Vector((math.cos(az), math.sin(az), 0))            # camera right
fwd = Vector((cx - tgt.x, cy - tgt.y, 0)).normalized()     # sign -> camera
lamp("Key", 'SPOT', tuple(tgt + fwd * 6.0 - side * 4.5 + Vector((0, 0, 3.6))), f("key", 2600), (1.0, 0.86, 0.66), 0.6, 58)
lamp("Fill", 'AREA', tuple(tgt + fwd * 5.0 + side * 5.0 + Vector((0, 0, 0.8))), f("fill", 260), (0.55, 0.72, 1.0), 4.0)
lamp("Rim", 'SPOT', tuple(tgt - fwd * 5.0 + side * 3.2 + Vector((0, 0, 4.2))), f("rim", 3600), (0.72, 0.92, 1.0), 0.3, 50)

bpy.data.objects["HaloSpot"].data.energy *= f("halo", 1.0)
for m in bpy.data.materials:
    if m.name in ("CrystalViolet", "Glow", "GlowViolet", "Rune", "PetalViolet"):
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Emission Strength'].default_value *= f("glow", 0.4)

# --- render ------------------------------------------------------------------
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = int(f("samples", 48))
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.render.resolution_percentage = int(f("pct", 100))
sc.render.image_settings.file_format = 'PNG'
sc.render.film_transparent = False
try:
    sc.view_settings.view_transform = opt.get("view", "AgX")
    sc.view_settings.look = opt.get("look", "None")
except Exception as e:
    print("view", e)
sc.view_settings.exposure = f("exp", 0)
sc.render.use_compositing = False
sc.render.filepath = out
if opt.get("save"):
    bpy.ops.wm.save_as_mainfile(filepath=opt["save"], compress=True, copy=True)
bpy.ops.render.render(write_still=True)
print("WROTE", out)
