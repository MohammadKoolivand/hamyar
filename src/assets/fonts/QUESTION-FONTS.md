Question typography uses locally bundled text/math fonts; it does not request a third-party font service at runtime.

- `BNazanin-Regular.ttf`: B Nazanin regular face, supplied by the project owner from https://github.com/intuxicated/css-persian/blob/master/fonts/BNazanin.ttf (source git blob `870801a7589ed33848155c7155c2cb9c474b9e42`). Used for non-bold PDF options and source labels. The source repository does not provide an explicit font redistribution license; the project owner should verify redistribution rights before public deployment.
- `BNazanin-Bold.ttf`: B Nazanin Bold, copyright (c) 2000 Borna Rayaneh, version 2.01, embedding flags 0. Full font retrieved from https://static.wfonts.com/data/2016/06/16/b-nazanin/BNaznnBd.ttf . The original exam PDF name table identifies this face for Persian question text and mathematical numerals. The embedded PDF font is a subset and cannot cover the entire question bank.
- Latin mathematical identifiers use local Times New Roman Bold where available, matching the PDF's named face, with STIX fallback on devices without that font.
- `STIXTwoMath-Regular.ttf`: https://github.com/google/fonts/tree/main/ofl/stixtwomath . Copyright/license: `STIXTwoMath-OFL.txt`. Provides native MathML geometry and missing operators.
- `AmiriQuestion-Bold.ttf`: previous unused substitute from https://github.com/google/fonts/tree/main/ofl/amiri . Copyright/license: `Amiri-OFL.txt`.

PDF operators also name Symbol and MT Extra. Native MathML is retained for accessible fractions, roots and positioning; exact pixel-for-pixel reproduction of the PDF's equation layout is not claimed. The application UI retains its existing font. Question fonts are not preloaded on pages without questions.
