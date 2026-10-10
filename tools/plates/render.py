"""Render a game .blend as a transparent plate.

blender -b file.blend --python render.py -- out.png key=val ...
  az, el      camera azimuth / elevation in degrees (az 0 looks along +Y, i.e. from the model's -Y front)
  lens        focal length mm
  w, h        resolution
  fit         extra framing margin (1.0 = tight)
  action, frame   pose a rig from an action
  hide        comma list of name substrings to hide
  only        comma list of name substrings to keep (everything else hidden)
  samples
  key, rim, fill, amb   light strengths
  keyaz, keyel          key direction relative to camera az
  ground      1 = shadow catcher under the model
  tx,ty,tz    target offset as a fraction of the bounds size
  list        1 = just print objects/actions and exit
"""
import bpy, sys, math
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--") + 1:]
out = argv[0]
opt = dict(a.split("=", 1) for a in argv[1:])
f = lambda k, d: float(opt.get(k, d))

sc = bpy.context.scene

if opt.get("list"):
    for o in bpy.data.objects:
        print("OBJ", o.type, o.name, [round(x, 2) for x in o.dimensions], "hidden" if o.hide_render else "")
    for a in bpy.data.actions:
        print("ACT", a.name, [round(x) for x in a.frame_range])
    for m in bpy.data.materials:
        print("MAT", m.name)
    sys.exit(0)

# --- what is drawn ----------------------------------------------------------
hide = [s for s in opt.get("hide", "").split(",") if s]
only = [s for s in opt.get("only", "").split(",") if s]
for o in bpy.data.objects:
    n = o.name
    if "colonly" in n or n.startswith("Col_"):
        o.hide_render = True
    if any(s in n for s in hide):
        o.hide_render = True
    if only and o.type == 'MESH' and not any(s in n for s in only):
        o.hide_render = True
    if o.type == 'LIGHT' and o.data.type == 'SUN':
        o.hide_render = True
    if o.type == 'CAMERA':
        o.hide_render = True

# --- the player's own look: shaders/player_void.gdshader, in nodes ----------
# Flat black with a faint sheen on the faces that turn away, eyes lit where the
# second UV's y is 1, and the blade drawn as its wireframe.
def void_mat(name, wire):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    out_n = N('ShaderNodeOutputMaterial')
    lw = N('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.5
    pw = N('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = f("rimpow", 2.2)
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    rim = N('ShaderNodeEmission'); rim.inputs[0].default_value = (0.42, 0.50, 0.62, 1)
    nt.links.new(pw.outputs[0], rim.inputs[1])
    gain = N('ShaderNodeMath'); gain.operation = 'MULTIPLY'; gain.inputs[1].default_value = f("rimgain", 1.0)
    nt.links.new(pw.outputs[0], gain.inputs[0]); nt.links.new(gain.outputs[0], rim.inputs[1])
    last = rim.outputs[0]
    if wire:
        wf = N('ShaderNodeWireframe'); wf.use_pixel_size = True; wf.inputs[0].default_value = f("wire", 1.4)
        we = N('ShaderNodeEmission'); we.inputs[0].default_value = (0.55, 0.64, 1.0, 1); we.inputs[1].default_value = 2.2
        mx = N('ShaderNodeMixShader')
        nt.links.new(wf.outputs[0], mx.inputs[0]); nt.links.new(last, mx.inputs[1]); nt.links.new(we.outputs[0], mx.inputs[2])
        last = mx.outputs[0]
    else:
        uv = N('ShaderNodeUVMap'); uv.uv_map = opt.get("uv2", "Wire2")
        sep = N('ShaderNodeSeparateXYZ'); nt.links.new(uv.outputs[0], sep.inputs[0])
        gt = N('ShaderNodeMath'); gt.operation = 'LESS_THAN'; gt.inputs[1].default_value = 0.5
        nt.links.new(sep.outputs[1], gt.inputs[0])
        eye = N('ShaderNodeEmission'); eye.inputs[0].default_value = (1.0, 0.80, 0.16, 1); eye.inputs[1].default_value = f("eye", 4.0)
        mx = N('ShaderNodeMixShader')
        nt.links.new(gt.outputs[0], mx.inputs[0]); nt.links.new(last, mx.inputs[1]); nt.links.new(eye.outputs[0], mx.inputs[2])
        last = mx.outputs[0]
    nt.links.new(last, out_n.inputs[0])
    return m

# a named material goes flat black with the same turned-away sheen (Big Al's coat)
for mn in [x for x in opt.get("rimmat", "").split(",") if x]:
    rm = void_mat("R_" + mn, True)
    # no wire, no eyes: keep only the sheen
    nt = rm.node_tree
    em = [n for n in nt.nodes if n.type == 'EMISSION' and abs(n.inputs[0].default_value[0] - 0.42) < 0.01][0]
    nt.links.new(em.outputs[0], next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL').inputs[0])
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for sl in o.material_slots:
                if sl.material and sl.material.name == mn:
                    sl.material = rm

if opt.get("void"):
    for o in bpy.data.objects:
        if o.type == 'MESH':
            print("UVS", o.name, [u.name for u in o.data.uv_layers])
            mat = void_mat("V_" + o.name, "Blade" in o.name)
            for i in range(len(o.material_slots)):
                o.material_slots[i].material = mat

# --- pose --------------------------------------------------------------------
if "action" in opt:
    act = bpy.data.actions.get(opt["action"])
    if act is None:
        print("NO ACTION", opt["action"], [a.name for a in bpy.data.actions][:80])
    else:
        for o in bpy.data.objects:
            if o.type == 'ARMATURE':
                if o.animation_data is None:
                    o.animation_data_create()
                o.animation_data.action = act
                try:
                    slots = act.slots
                    if len(slots):
                        o.animation_data.action_slot = slots[0]
                except Exception as e:
                    print("slot", e)
if "frame" in opt:
    sc.frame_set(int(f("frame", 1)))
bpy.context.view_layer.update()

# --- bounds of what is drawn -------------------------------------------------
deps = bpy.context.evaluated_depsgraph_get()
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for o in bpy.data.objects:
    if o.type != 'MESH' or o.hide_render:
        continue
    ev = o.evaluated_get(deps)
    me = ev.to_mesh()
    mw = ev.matrix_world
    step = max(1, len(me.vertices) // 4000)
    for i in range(0, len(me.vertices), step):
        w = mw @ me.vertices[i].co
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
    ev.to_mesh_clear()
size = hi - lo
ctr = (lo + hi) * 0.5
ctr += Vector((size.x * f("tx", 0), size.y * f("ty", 0), size.z * f("tz", 0)))
rad = size.length * 0.5
print("BOUNDS", [round(x, 2) for x in lo], [round(x, 2) for x in hi])

# --- camera ------------------------------------------------------------------
W, H = int(f("w", 1600)), int(f("h", 1200))
cam_d = bpy.data.cameras.new("PlateCam")
cam = bpy.data.objects.new("PlateCam", cam_d)
sc.collection.objects.link(cam)
cam_d.lens = f("lens", 60)
cam_d.sensor_width = 36
az = math.radians(f("az", 30))
el = math.radians(f("el", 15))
dirv = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
fov = 2 * math.atan(18 / cam_d.lens) * min(1.0, H / W)
dist = rad / math.sin(fov / 2) * f("fit", 1.0)
cam.location = ctr + dirv * dist
q = (-dirv).to_track_quat('-Z', 'Y')
from mathutils import Quaternion
cam.rotation_euler = (q @ Quaternion((0, 0, 1), math.radians(f('roll', 0)))).to_euler()
cam_d.clip_start = max(0.01, dist * 0.01)
cam_d.clip_end = dist * 10 + rad * 4
sc.camera = cam


def sun(name, a, e, strength, color, angle=6):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = strength
    d.color = color
    d.angle = math.radians(angle)
    o = bpy.data.objects.new(name, d)
    sc.collection.objects.link(o)
    v = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    o.rotation_euler = v.to_track_quat('Z', 'Y').to_euler()
    return o

# the board's own two lights: gold from the front, ice from behind
keyaz = az + math.radians(f("keyaz", -42))
sun("Key", keyaz, math.radians(f("keyel", 38)), f("key", 3.2), (1.0, 0.93, 0.80))
sun("Rim", az + math.radians(f("rimaz", 150)), math.radians(f("rimel", 28)), f("rim", 3.0), (0.72, 0.92, 1.0), 3)
sun("Fill", az + math.radians(70), math.radians(10), f("fill", 0.5), (0.62, 0.72, 0.82), 30)

# --- world -------------------------------------------------------------------
w = bpy.data.worlds.new("PlateWorld")
w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (0.30, 0.40, 0.52, 1)
bg.inputs[1].default_value = f("amb", 0.35)
sc.world = w

# --- ground ------------------------------------------------------------------
if opt.get("ground"):
    bpy.ops.mesh.primitive_plane_add(size=rad * 40, location=(ctr.x, ctr.y, lo.z + f("gz", 0)))
    g = bpy.context.active_object
    g.is_shadow_catcher = True

# --- render ------------------------------------------------------------------
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = int(f("samples", 96))
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6
sc.render.threads_mode = 'AUTO'
sc.render.film_transparent = True
sc.render.resolution_x = W
sc.render.resolution_y = H
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
try:
    sc.view_settings.view_transform = opt.get("view", "Standard")
    sc.view_settings.look = 'None'
except Exception as e:
    print("view", e)
sc.view_settings.exposure = f("exp", 0)
sc.render.use_compositing = False
sc.render.use_sequencer = False
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("WROTE", out)
