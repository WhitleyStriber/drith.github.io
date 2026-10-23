import sys, os
from PIL import Image
H='/home/djt/Pictures/hyprshot/'; T='/home/djt/Games/Godot/drith-godot/tools/shots/'
B='/home/djt/Work/buildscripts/'; A='/home/djt/.local/share/godot/app_userdata/Drith/'
M='/home/djt/Games/Godot/drith-godot/ui/mockups/img/'
HUD=(0.10,0.07,0.88,0.85)
J=[
('g_island',H+'2026-10-19-112414_hyprshot.png',(0.02,0.02,0.98,0.84)),
('g_lawn',H+'2026-10-19-112428_hyprshot.png',(0.0,0.06,0.9,0.86)),
('g_hill',H+'2026-10-19-112558_hyprshot.png',(0.06,0.05,0.94,0.86)),
('g_counter',H+'2026-10-19-211208_hyprshot.png',(0.12,0.10,0.90,0.86)),
('g_fruit',H+'2026-10-20-173159_hyprshot.png',(0.08,0.06,0.86,0.84)),
('g_pet',H+'2026-10-20-223850_hyprshot.png',(0.0,0.0,1.0,1.0)),
('g_grotto',H+'2026-10-18-012209_hyprshot.png',HUD),
('g_grotto_pink',H+'2026-10-18-151651_hyprshot.png',(0.10,0.10,0.86,0.86)),
('g_grotto_mouth',H+'2026-10-18-152411_hyprshot.png',(0.30,0.0,1.0,0.84)),
('g_bridge',H+'2026-10-23-185031_hyprshot.png',(0.0,0.0,0.9,0.84)),
('g_hatch',T+'oumo_eggs_hatchlings_close.png',(0,0,1,1)),
('g_shells',T+'oumo_eggs_shells.png',(0,0,1,1)),
('g_rainbow',T+'oumo_fruit_rainbow_close.png',(0,0,1,1)),
('g_imbuer',T+'oumo_imbue_machine.png',(0,0,1,1)),
('g_souldrop',T+'oumo_imbue_soul_drop.png',(0,0,1,1)),
('g_tank',T+'oumo_imbue_tank.png',(0,0,1,1)),
('g_cocoon',T+'oumo_growth_cocoon_ultima.png',(0,0,1,1)),
('g_ultima',T+'oumo_growth_ultima.png',(0,0,1,1)),
('g_read',T+'oumo_pastime_read.png',(0,0,1,1)),
('g_watch',T+'oumo_pastime_watch.png',(0,0,1,1)),
('g_swim',T+'oumo_swim_laps.png',HUD),
('g_board',T+'oumo_boutique_board.png',(0,0,1,1)),
('g_eggboard',T+'oumo_eggs_board.png',(0,0,1,1)),
('g_playset',T+'oumo_playset_wide.png',(0,0,1,1)),
('g_boutique_island',T+'oumo_boutique_island.png',(0,0,1,1)),
('g_lineup',M+'oumo_growths/game_lineup.png',(0,0,1,1)),
('g_faces',M+'oumo_growths/game_faces.png',(0,0,1,1)),
('r_fountain',H+'2026-10-23-182300_hyprshot.png',(0.0,0.0,0.9,0.84)),
('r_plaza',H+'2026-10-23-181551_hyprshot.png',(0.08,0.08,0.84,0.86)),
('r_arcade',H+'2026-10-21-185852_hyprshot.png',HUD),
('r_snack',H+'2026-10-18-165004_hyprshot.png',(0.0,0.0,1.0,0.86)),
('r_pitcher',B+'pitcher_shop/out/pitcher_shop_3.png',(0,0,1,1)),
('r_pitcher_door',B+'pitcher_shop/out/pitcher_shop_door.png',(0,0,1,1)),
('c_radio',H+'2026-10-16-012459_hyprshot.png',(0.08,0.06,0.84,0.86)),
('c_radio_base',H+'2026-10-21-182228_hyprshot.png',HUD),
('c_tower',H+'2026-10-23-124401_hyprshot.png',(0.04,0.10,0.86,0.86)),
('c_ice',H+'2026-10-21-190739_hyprshot.png',HUD),
('c_sawmill',H+'2026-10-23-152027_hyprshot.png',HUD),
('c_oilrig',B+'oilrig/shots/oilrig_world_east_main.png',(0.1,0.08,0.86,0.84)),
('c_post',B+'post/shots/post_corbels.png',(0,0,1,1)),
('c_post_walk',B+'post/shots/post_walk.png',(0,0,1,1)),
('c_hazard',B+'hazard/shots/hazard_air_east.png',(0,0,1,1)),
('c_hazard_spawn',B+'hazard/shots/hazard_spawn.png',(0,0,1,1)),
('c_corey',H+'2026-10-23-125606_hyprshot.png',(0,0,1,1)),
('m_spirit',H+'2026-10-23-131209_hyprshot.png',(0.10,0.07,0.86,0.86)),
('k_cluster',A+'grenade_cluster_blasts.png',(0.12,0.08,0.88,0.84)),
('k_fire',A+'grenade_fire.png',(0.12,0.08,0.88,0.84)),
('k_emp',A+'grenade_emp.png',(0.12,0.08,0.88,0.84)),
('k_blister',A+'genesis_blister_0.png',(0,0,1,1)),
('k_codex',H+'2026-10-17-201055_hyprshot.png',(0,0,1,1)),
]
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
for n,f,(a,b,c,d) in J:
    if not os.path.exists(f): print('MISSING',n,f); continue
    i=Image.open(f).convert('RGB'); W,Hh=i.size
    i=i.crop((int(a*W),int(b*Hh),int(c*W),int(d*Hh)))
    if i.width>1600: i=i.resize((1600,round(i.height*1600/i.width)),Image.LANCZOS)
    i.save(f'{out}/{n}.webp',quality=80,method=6); print(n,i.size)
