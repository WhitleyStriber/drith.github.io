import bpy, json, sys, os
from mathutils import Matrix

out = sys.argv[-1]

# Godot imports .blend through Blender's own glTF exporter, which is Y-up.
# Blender is Z-up, so the whole scene turns -90 about X on the way out.
YUP = Matrix.Rotation(-1.5707963267948966, 4, 'X')

deps = bpy.context.evaluated_depsgraph_get()
verts = []
tris = []

meshes = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
print("objects:", [o.name for o in meshes], file=sys.stderr)

for ob in meshes:
    ev = ob.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()

    # corner_normals is the SPLIT normal per loop: it already carries flat vs
    # smooth shading, sharp edges and any custom normal data — which is exactly
    # what the glTF exporter hands Godot. Reading vertex normals instead smooths
    # every crease on the model and the hull's Fresnel goes soft.
    try:
        cn = [tuple(n.vector) for n in me.corner_normals]
    except AttributeError:
        me.calc_normals_split()
        cn = [tuple(l.normal) for l in me.loops]

    mw = YUP @ ob.matrix_world
    nm = mw.to_3x3().inverted_safe().transposed()

    key = {}
    for lt in me.loop_triangles:
        idx = []
        for li in lt.loops:
            l = me.loops[li]
            co = mw @ me.vertices[l.vertex_index].co
            n = (nm @ __import__('mathutils').Vector(cn[li])).normalized()
            k = (round(co.x, 5), round(co.y, 5), round(co.z, 5),
                 round(n.x, 3), round(n.y, 3), round(n.z, 3))
            j = key.get(k)
            if j is None:
                j = len(verts)
                key[k] = j
                verts.append([round(co.x, 5), round(co.y, 5), round(co.z, 5),
                              round(n.x, 4), round(n.y, 4), round(n.z, 4)])
            idx.append(j)
        tris.append(idx)
    ev.to_mesh_clear()

uniq = len(set((round(v[3], 2), round(v[4], 2), round(v[5], 2)) for v in verts))
print("verts:", len(verts), "tris:", len(tris), "distinct normals:", uniq, file=sys.stderr)

flatV = []
for v in verts:
    flatV.extend(v)
flatT = []
for t in tris:
    flatT.extend(t)

with open(out, 'w') as f:
    json.dump({"v": flatV, "t": flatT}, f, separators=(',', ':'))
print("wrote", out, os.path.getsize(out), file=sys.stderr)
