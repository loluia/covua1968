/* ===================================================================
   openings.js — compact ECO opening book (~70 openings).
   Keys are SAN move sequences (space-joined). detectOpening() finds
   the longest prefix match in the current move history.
=================================================================== */
const OPENING_BOOK = {
  // ── 1. e4 openings ──────────────────────────────────────────────
  'e4':                                        "Khai cuộc Tốt Vua",
  'e4 e5':                                     "Ván cờ mở",
  'e4 e5 Nf3':                                 "Khai cuộc Mã Vua",
  'e4 e5 Nf3 Nc6':                             "Ván cờ mở (Nc6)",
  'e4 e5 Nf3 Nc6 Bc4':                         "Khai cuộc Ý (Italian)",
  'e4 e5 Nf3 Nc6 Bc4 Bc5':                     "Giuoco Piano",
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3':                  "Giuoco Piano: Biến thể chính",
  'e4 e5 Nf3 Nc6 Bc4 Nf6':                     "Ý: Phòng thủ Hai Mã",
  'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5':                 "Ý: Tấn công Fried Liver",
  'e4 e5 Nf3 Nc6 Bb5':                         "Khai cuộc Tây Ban Nha (Ruy López)",
  'e4 e5 Nf3 Nc6 Bb5 a6':                      "Ruy López: Phòng thủ Morphy",
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6':              "Ruy López: Biến thể Mở",
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O':          "Ruy López: Kín",
  'e4 e5 Nf3 Nc6 Bb5 Nf6':                     "Ruy López: Tấn công Berlin",
  'e4 e5 Nf3 Nf6':                             "Phòng thủ Petrov",
  'e4 e5 Nf3 f5':                              "Gambit Latvian",
  'e4 e5 f4':                                  "Gambit Vua",
  'e4 e5 f4 exf4':                             "Gambit Vua Chấp nhận",
  'e4 e5 f4 Bc5':                              "Gambit Vua Từ chối",
  'e4 e5 Nc3':                                 "Trò chơi Vienna",
  'e4 e5 Bc4':                                 "Khai cuộc Tượng Vua",
  // Sicilian
  'e4 c5':                                     "Phòng thủ Sicilian",
  'e4 c5 Nf3':                                 "Sicilian: Nf3",
  'e4 c5 Nf3 d6':                              "Sicilian: Biến thể Najdorf",
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6':     "Sicilian: Najdorf",
  'e4 c5 Nf3 Nc6':                             "Sicilian: Biến thể Cổ điển",
  'e4 c5 Nf3 e6':                              "Sicilian: Kan",
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6':            "Sicilian: Rồng (Dragon)",
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6':   "Sicilian: Scheveningen",
  'e4 c5 c3':                                  "Sicilian: Biến thể Alapin (c3)",
  'e4 c5 Nc3':                                 "Sicilian: Nc3",
  'e4 c5 f4':                                  "Sicilian: Tấn công Cánh hậu",
  // Caro-Kann
  'e4 c6':                                     "Phòng thủ Caro-Kann",
  'e4 c6 d4 d5':                               "Caro-Kann: Biến thể chính",
  'e4 c6 d4 d5 Nc3 dxe4 Nxe4':                "Caro-Kann: Cổ điển",
  'e4 c6 d4 d5 e5':                            "Caro-Kann: Tấn công Advance",
  // French
  'e4 e6':                                     "Phòng thủ Pháp (French)",
  'e4 e6 d4 d5':                               "French: Biến thể chính",
  'e4 e6 d4 d5 e5':                            "French: Advance",
  'e4 e6 d4 d5 Nc3':                           "French: Winawer / Classical",
  'e4 e6 d4 d5 Nc3 Bb4':                       "French: Winawer",
  'e4 e6 d4 d5 Nc3 Nf6':                       "French: Classical",
  // Scandinavian
  'e4 d5':                                     "Phòng thủ Scandinavian",
  'e4 d5 exd5 Qxd5':                           "Scandinavian: Biến thể chính",
  'e4 d5 exd5 Nf6':                            "Scandinavian: Icelandic",
  // Other e4
  'e4 d6':                                     "Phòng thủ Pirc",
  'e4 g6':                                     "Phòng thủ Modern",
  'e4 Nf6':                                    "Phòng thủ Alekhine",

  // ── 1. d4 openings ──────────────────────────────────────────────
  'd4':                                        "Khai cuộc Tốt Hậu",
  'd4 d5':                                     "Ván cờ Tốt Hậu",
  'd4 d5 c4':                                  "Gambit Hậu",
  'd4 d5 c4 dxc4':                             "Gambit Hậu Chấp nhận",
  'd4 d5 c4 e6':                               "Gambit Hậu Từ chối",
  'd4 d5 c4 e6 Nc3 Nf6 Bg5':                  "QGD: Biến thể cổ điển",
  'd4 d5 c4 c6':                               "Phòng thủ Slav",
  'd4 d5 c4 c6 Nf3 Nf6 Nc3':                  "Slav: Biến thể chính",
  'd4 d5 c4 Nc6':                              "Chigorin Defense",
  // Indian defenses
  'd4 Nf6':                                    "Phòng thủ Ấn Độ",
  'd4 Nf6 c4':                                 "Khai cuộc Ấn Độ",
  'd4 Nf6 c4 g6':                              "Phòng thủ Ấn Độ Vua (KID)",
  'd4 Nf6 c4 g6 Nc3 Bg7 e4':                  "KID: Biến thể chính",
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Bc4':  "KID: Biến thể Classical",
  'd4 Nf6 c4 e6':                              "Nimzo / QID / Catalan",
  'd4 Nf6 c4 e6 Nc3 Bb4':                     "Phòng thủ Nimzo-Ấn Độ",
  'd4 Nf6 c4 e6 Nf3 b6':                      "Phòng thủ Ấn Độ Hậu (QID)",
  'd4 Nf6 c4 e6 g3':                           "Khai cuộc Catalan",
  'd4 Nf6 c4 c5':                              "Phòng thủ Benoni",
  'd4 Nf6 c4 c5 d5 e6':                       "Benoni hiện đại",
  'd4 Nf6 Nf3':                                "Khai cuộc London hệ",
  'd4 Nf6 Nf3 d5 Bf4':                        "Hệ London",
  'd4 Nf6 Nf3 d5 c4':                         "Hệ Hậu",
  'd4 f5':                                     "Phòng thủ Hà Lan (Dutch)",
  'd4 f5 c4 Nf6 g3':                          "Dutch: Leningrad",

  // ── 1. c4 / 1. Nf3 openings ─────────────────────────────────────
  'c4':                                        "Khai cuộc Anh (English)",
  'c4 e5':                                     "English: King's English",
  'c4 Nf6':                                    "English: Indian",
  'c4 c5':                                     "English: Đối xứng",
  'Nf3':                                       "Khai cuộc Reti",
  'Nf3 d5 c4':                                 "Khai cuộc Reti: Biến thể chính",
  'b3':                                        "Khai cuộc Nimzowitsch-Larsen",
  'f4':                                        "Khai cuộc Bird",
  'g3':                                        "Khai cuộc Benko",
};

/**
 * Returns the name of the most specific known opening for the given
 * SAN move history, or null if no match found.
 */
function detectOpening(sanHistory){
  if(!sanHistory||!sanHistory.length) return null;
  const key=sanHistory.join(' ');
  let best=null,bestLen=0;
  for(const[seq,name] of Object.entries(OPENING_BOOK)){
    if(key===seq||key.startsWith(seq+' ')){
      if(seq.length>bestLen){best=name;bestLen=seq.length;}
    }
  }
  return best;
}
