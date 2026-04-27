# -*- coding: utf-8 -*-
"""
Spacecraft Mission Visualizer
Includes: Static 3D Gradient, 2D Speed Dashboard, and 3D Trajectory Animation
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Line3DCollection
from matplotlib.animation import FuncAnimation
import seaborn as sns

# ==========================================
# 1. VISUAL UPGRADE & DATA LOADING
# ==========================================
plt.style.use('dark_background')

# Load dataset
df = pd.read_csv("dataset.csv")

# Use .copy() to avoid SettingWithCopyWarning
sc = df[df['body'] == 'spacecraft'].copy()
earth = df[df['body'] == 'earth'].copy()
moon = df[df['body'] == 'moon'].copy()

# Sort spacecraft by time to ensure a smooth, continuous line
if 'time' in sc.columns:
    sc = sc.sort_values(by='time')

# ⚠️ IMPORTANT: Performance Fix (Sampling)
# Downsample by taking every 10th row for performance, resetting index for safe animation slicing
sc = sc.iloc[::10].reset_index(drop=True)
moon = moon.iloc[::10].reset_index(drop=True)

# SCALE COORDINATES (Raw to 1000 km)
scale = 1000
for d in [sc, earth, moon]:
    d['x'] /= scale
    d['y'] /= scale
    d['z'] /= scale

# Calculate axis limits for later use (keeps animation camera stable)
max_lim = max(sc['x'].max(), sc['y'].max(), sc['z'].max(), moon['x'].max())
min_lim = min(sc['x'].min(), sc['y'].min(), sc['z'].min(), moon['x'].min())

# ==========================================
# 2. STATIC 3D PLOT (The "3D Space Look")
# ==========================================
fig1 = plt.figure(figsize=(12, 9))
ax1 = fig1.add_subplot(111, projection='3d')

# Earth (Bigger, prominent point)
ax1.scatter(earth.iloc[0]['x'], earth.iloc[0]['y'], earth.iloc[0]['z'], 
            color='dodgerblue', s=300, label='Earth')

# Moon trajectory (Faint, dashed path)
ax1.plot(moon['x'], moon['y'], moon['z'], 
         color='lightgray', linestyle='dashed', linewidth=1.5, alpha=0.5, label='Moon Orbit')

# Moon's final position (Solid dot)
ax1.scatter(moon.iloc[-1]['x'], moon.iloc[-1]['y'], moon.iloc[-1]['z'], 
            color='silver', s=100)

# Speed-Based Color Gradient for Spacecraft
speed = sc['speed'] if 'speed' in sc.columns else np.linspace(0, 10, len(sc))

points = np.array([sc['x'], sc['y'], sc['z']]).T.reshape(-1, 1, 3)
segments = np.concatenate([points[:-1], points[1:]], axis=1)

lc = Line3DCollection(segments, cmap='plasma', linewidth=2.5)
lc.set_array(speed)
ax1.add_collection(lc)

# Invisible line to force Matplotlib limits
ax1.plot(sc['x'], sc['y'], sc['z'], alpha=0.0) 

# Colorbar
cbar = fig1.colorbar(lc, ax=ax1, pad=0.1, shrink=0.5)
cbar.set_label('Speed')

# Final Polish
ax1.set_title("Spacecraft Trajectory (Earth → Moon)", fontsize=16, fontweight='bold', pad=20)
ax1.set_xlabel("X (1000 km)")
ax1.set_ylabel("Y (1000 km)")
ax1.set_zlabel("Z (1000 km)")
ax1.set_box_aspect([1, 1, 1])

# Clean up grid for "void of space"
ax1.xaxis.pane.fill = False
ax1.yaxis.pane.fill = False
ax1.zaxis.pane.fill = False
ax1.grid(color='white', alpha=0.15)
ax1.legend(loc='upper left')

# 🎯 NEW: Upgraded Camera Angle
ax1.view_init(elev=25, azim=45)

plt.show()

# ==========================================
# 3. DASHBOARD-STYLE GRAPHS (2D)
# ==========================================
# Reset style so Seaborn's darkgrid looks correct (white background with dark grids)
plt.style.use('default')
sns.set_style("darkgrid")

fig2 = plt.figure(figsize=(10, 5))

# Plot speed profile
sns.lineplot(x='time', y='speed', data=sc, linewidth=2, color='darkorange')

# 📊 Add event markers (checking if 'event_flag' exists to prevent errors)
if 'event_flag' in sc.columns:
    events = sc[sc['event_flag'].notna()]
    for _, row in events.iterrows():
        plt.axvline(x=row['time'], linestyle='--', color='gray', alpha=0.7)
        plt.text(row['time'], sc['speed'].max() * 0.95, row['event_flag'], 
                 rotation=90, fontsize=9, verticalalignment='top')

plt.title("Speed Profile of Mission", fontsize=14, fontweight='bold')
plt.xlabel("Time")
plt.ylabel("Speed")
plt.tight_layout()
plt.show()


# ==========================================
# 4. ANIMATION (The Big Win)
# ==========================================
# Re-apply space theme for the animation
plt.style.use('dark_background')

fig3 = plt.figure(figsize=(10, 8))
ax_anim = fig3.add_subplot(111, projection='3d')

def update(frame):
    # Prevent crashing on frame 0
    if frame == 0: 
        return
        
    ax_anim.clear()
    
    # Plot trajectory till current frame
    ax_anim.plot(sc['x'].iloc[:frame], sc['y'].iloc[:frame], sc['z'].iloc[:frame], 
                 color='cyan', linewidth=2)
    
    # Current spacecraft position
    ax_anim.scatter(sc['x'].iloc[frame], sc['y'].iloc[frame], sc['z'].iloc[frame], 
                    color='yellow', s=50)
    
    # Earth (Fixed)
    ax_anim.scatter(0, 0, 0, color='dodgerblue', s=200)
    
    # Moon (Moving along its orbit based on the frame)
    # Safely handle moon index in case moon data is slightly shorter/longer than sc
    m_idx = min(frame, len(moon)-1) 
    ax_anim.scatter(moon['x'].iloc[m_idx], moon['y'].iloc[m_idx], moon['z'].iloc[m_idx], 
                    color='silver', s=100)
    
    # 🛠️ CRITICAL FIX: Lock the axes limits so the camera doesn't jump every frame!
    ax_anim.set_xlim([min_lim, max_lim])
    ax_anim.set_ylim([min_lim, max_lim])
    ax_anim.set_zlim([min_lim, max_lim])
    
    # Aesthetics
    ax_anim.set_title(f"Trajectory Animation - Frame {frame}", fontsize=14)
    ax_anim.xaxis.pane.fill = False
    ax_anim.yaxis.pane.fill = False
    ax_anim.zaxis.pane.fill = False
    ax_anim.grid(color='white', alpha=0.15)
    ax_anim.view_init(elev=25, azim=45)

# Build animation (skipping by 2s or 5s inside the frames range can speed it up further if needed)
ani = FuncAnimation(fig3, update, frames=len(sc), interval=20)

plt.show()