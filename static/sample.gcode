(Sample G-Code file for testing NCView)
(Generated for demonstration purposes)

G21 (Millimeter units)
G90 (Absolute positioning)
G17 (XY plane selection)

(Tool change)
M6 T1 (Change to tool 1)
M3 S1000 (Start spindle at 1000 RPM)

(Rapid move to start position)
G0 X0 Y0 Z5

(Feed rate setting)
F200

(Begin cutting operations)
G1 Z-2 (Plunge to cutting depth)
G1 X10 Y0 (Cut to X10)
G1 X10 Y10 (Cut to Y10)
G1 X0 Y10 (Cut to X0)
G1 X0 Y0 (Cut back to origin)

(Lift and move operations)
G0 Z5 (Rapid retract)
G0 X20 Y20 (Rapid move to new position)

(Second cutting pass)
G1 Z-2 F100 (Slower plunge)
G2 X30 Y20 I5 J0 F150 (Clockwise arc)
G1 X30 Y30 (Linear move)
G3 X20 Y30 I-5 J0 (Counter-clockwise arc)
G1 Y20 (Close the shape)

(Tool retract and program end)
G0 Z25 (Safe height)
M5 (Stop spindle)
M30 (Program end and rewind)