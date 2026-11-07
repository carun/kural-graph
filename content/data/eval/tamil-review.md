# Tamil text review

The base text is [tk120404/thirukkural](https://github.com/tk120404/thirukkural). It was checked against three
other sources, and with tests that don't depend on any edition:

- **Project Madurai.** The dataset evidently descends from this text and inherits its encoding damage.
- **Wikisource, திருக்குறள், மூலம்.** Proofread scans of a printed 1997 edition. It shares a few of the same
  odd errors, so it was probably seeded from the Madurai text. It is only partly independent.
- **Wikisource, பரிமேலழகர் உரை.** Typed separately, with word-by-word glosses. This is the strongest witness.
- **Rules of the language.** Impossible consonant clusters, damaged shapes, and the fixed 4+3 feet of a kural.

Decisions live in `data/clean/tamil-fixes.yaml`. To accept one, set its `status` to `approved`.

**105 decisions, 0 still proposed.**

## Choices between readings (2)

Decided by the reviewer.

| Kural | Dataset | Proposed | Why |
|---|---|---|---|
| 67.1 | தந்தை மகற்காற்றும் நன்றி அவையத்து | தந்தை மகற்காற்று நன்றி அவையத்து | மகற்காற்றும் vs மகற்காற்று. Madurai, Wikisource and Parimelazhagar all have மகற்காற்று. |
| 276.1 | நெஞ்சின் துறவார் துறந்தார்போல் வஞ்சித்து | நெஞ்சின் துறவார் துறந்தார்போல் வஞ்சித்து | Reviewer's decision: நெஞ்சின், the dataset's reading. Wikisource has நெஞ்சில், and Parimelazhagar's நெஞ்சிற் றுறவார் points the same way. |

## Repairs of damaged text (63)

| Kural | Dataset | Proposed | Why |
|---|---|---|---|
| 51.1 | மனைக்தக்க மாண்புடையள் ஆகித்தற் கொண்டான் | மனைத்தக்க மாண்புடையள் ஆகித்தற் கொண்டான் | க்த is impossible in Tamil, and all three copies share it. Parimelazhagar has மனைத்தக்க. |
| 74.2 | நண்பு என்னும் நாடாச் சிறப்பு. | நண்பென்னும் நாடாச் சிறப்பு. | Wikisource; Parimelazhagar supports it. |
| 86.2 | நல்வருந்து வானத் தவர்க்கு. | நல்விருந்து வானத் தவர்க்கு. | All three copies share this. Parimelazhagar has நல்விருந்து, the subject of the chapter. |
| 90.2 | நோக்கக் குநழ்யும் விருந்து. | நோக்கக் குழையும் விருந்து. | Wikisource; Parimelazhagar supports it. |
| 98.1 | சிறுமையுவு நீங்கிய இன்சொல் மறுமையும் | சிறுமையுள் நீங்கிய இன்சொல் மறுமையும் | Wikisource; Parimelazhagar supports it. |
| 154.1 | நிறையுடைமை நீங்காமை வேண்டின் பொற்யுடைமை | நிறையுடைமை நீங்காமை வேண்டின் பொறையுடைமை | Wikisource; Parimelazhagar supports it. |
| 165.2 | வழுக்காயும் கேடீன் பது. | வழுக்கியும் கேடீன் பது. | Wikisource; Parimelazhagar supports it. |
| 183.2 | அறங்கூற்றும் ஆக்கத் தரும். | அறங்கூறும் ஆக்கந் தரும். | Wikisource; Parimelazhagar supports it. |
| 204.2 | அறஞ்சூழம் சூழ்ந்தவன் கேடு. | அறஞ்சூழும் சூழ்ந்தவன் கேடு. | Wikisource; Parimelazhagar supports it. |
| 208.2 | வீயாது அஇஉறைந் தற்று. | வீயாது அடிஉறைந் தற்று. | Wikisource; Parimelazhagar supports it. |
| 214.1 | ஒத்த தறவோன் உயிர்வாழ்வான் மற்றையான் | ஒத்த தறிவான் உயிர்வாழ்வான் மற்றையான் | Wikisource; Parimelazhagar supports it. |
| 242.1 | நல்லாற்றாள் நாடி அருளாள்க பல்லாற்றால் | நல்லாற்றால் நாடி அருளாள்க பல்லாற்றால் | Wikisource; Parimelazhagar supports it. |
| 253.1 | படைகொண்டார் நெஞ்சம்போல் நன்னூக்காது ஒன்றன் | படைகொண்டார் நெஞ்சம்போல் நன்றூக்காது ஒன்றன் | Wikisource; Parimelazhagar supports it. |
| 262.1 | தவமும் தவமுடையார்க்கு ஆகும் அதனை | தவமும் தவமுடையார்க்கு ஆகும் அவமதனை | All three copies lost அவம். Parimelazhagar's verse has அவமதனை, and his gloss turns on it ("மேற்கொள்வது அவம்"). Found while writing the readings. |
| 269.2 | ஆற்றல் தலைப்பட் டவர்க்குல். | ஆற்றல் தலைப்பட் டவர்க்கு. | Wikisource; Parimelazhagar supports it. |
| 277.2 | முக்கிற் கரியார் உடைத்து. | மூக்கிற் கரியார் உடைத்து. | Wikisource; Parimelazhagar supports it. |
| 287.2 | ஆற்றல் புரிந்தார்கண்ட இல். | ஆற்றல் புரிந்தார்கண் இல். | Wikisource; Parimelazhagar supports it. |
| 290.1 | கள்வார்க்குத் தள்ளும் உயிர்நிலை கள்வார்க்குத் | கள்வார்க்குத் தள்ளும் உயிர்நிலை கள்ளார்க்குத் | Wikisource; Parimelazhagar supports it. |
| 290.2 | தள்ளாது புத்தே ளுளகு. | தள்ளாது புத்தே ளுலகு. | Wikisource; Parimelazhagar supports it. |
| 298.1 | புறள்தூய்மை நீரான் அமையும் அகந்தூய்மை | புறந்தூய்மை நீரான் அமையும் அகந்தூய்மை | Wikisource; Parimelazhagar supports it. |
| 318.1 | தன்னுயிர்ககு ஏன்னாமை தானறிவான் என்கொலோ | தன்னுயிர்க்கு இன்னாமை தானறிவான் என்கொலோ | Dataset is corrupt and Wikisource has its own typo (தன்னயிர்க்கு). Parimelazhagar confirms தன்னுயிர்க். |
| 360.1 | காமம் வெகுளி மயக்கம் இவ்மூன்றன் | காமம் வெகுளி மயக்கம் இவைமூன்றன் | Wikisource; Parimelazhagar supports it. |
| 383.2 | நீங்கா நிலனான் பவர்க்கு. | நீங்கா நிலனாள் பவர்க்கு. | Wikisource. |
| 412.1 | செவுக்குண வில்லாத போழ்து சிறிது | செவிக்குண வில்லாத போழ்து சிறிது | All three copies share this. Parimelazhagar has செவிக்குண. |
| 434.2 | அற்றந் த்ரூஉம் பகை. | அற்றந் தரூஉம் பகை. | த்ரூ is impossible in Tamil, and all three copies share it. Parimelazhagar has தரூஉம். |
| 469.1 | நன்றாற்ற லுள்ளுந் தவுறுண்டு அவரவர் | நன்றாற்ற லுள்ளுந் தவறுண்டு அவரவர் | All three copies share this; தவுறு is not a word. The chapter's sense and Parimelazhagar's தவறு support it. |
| 477.1 | ஆற்றின் அறவறிந்து ஈக அதுபொருள் | ஆற்றின் அளவறிந்து ஈக அதுபொருள் | All three copies share this. Parimelazhagar has அளவறிந், split as அளவு அறிந்து. |
| 483.2 | காலம் அற஧ந்து செயின். | காலம் அறிந்து செயின். | Invalid code point. Madurai and Wikisource agree; Parimelazhagar supports it. |
| 589.1 | ஒற்றெற் றுணராமை ஆள்க உடன்மூவர் | ஒற்றொற் றுணராமை ஆள்க உடன்மூவர் | All three copies share this. Parimelazhagar has ஒற்றொற். |
| 599.2 | ஦வ்ருஉம் புலிதாக் குறின். | வெரூஉம் புலிதாக் குறின். | Invalid code point. Wikisource; Parimelazhagar supports it. |
| 639.1 | பழுதெண்ணும் மந்திரியின் பக்கததுள் தெவ்வோர் | பழுதெண்ணும் மந்திரியின் பக்கத்துள் தெவ்வோர் | All three copies share this. Parimelazhagar has பக்கத்துள். |
| 650.1 | இணருழ்த்தும் நாறா மலரனையர் கற்றது | இணர்ஊழ்த்தும் நாறா மலரனையர் கற்றது | Wikisource. |
| 651.1 | துணைநலம் ஆக்கம் த்ருஉம் வினைநலம் | துணைநலம் ஆக்கம் தரூஉம் வினைநலம் | Wikisource; Parimelazhagar supports it. |
| 653.1 | ஒஓதல் வேண்டும் ஒளிமாழ்கும் செய்வினை | ஓஒதல் வேண்டும் ஒளிமாழ்கும் செய்வினை | Wikisource; Parimelazhagar supports it. |
| 689.2 | வாய்சேரா வன்கணவன். | வாய்சோரா வன்க ணவன். | All three copies have வாய்சேரா. Parimelazhagar's verse and gloss have வாய்சோரா, words of blame that don't slip from the mouth. Spacing also restores the 3 feet this line must have. |
| 701.1 | கூறாமை நோக்கக் குறிப்பறிவான் எஞ்ஞான்றும் | கூறாமை நோக்கிக் குறிப்பறிவான் எஞ்ஞான்றும் | Madurai and Wikisource agree; Parimelazhagar supports it. |
| 711.1 | அவையறிநது ஆராய்ந்து சொல்லுக சொல்லின் | அவையறிந்து ஆராய்ந்து சொல்லுக சொல்லின் | Wikisource; Parimelazhagar supports it. |
| 719.2 | நன்குசலச் சொல்லு வார். | நன்குசெலச் சொல்லு வார். | Wikisource; Parimelazhagar supports it. |
| 775.1 | விழித்தகண் வேல்கொண டெறிய அழித்திமைப்பின் | விழித்தகண் வேல்கொண் டெறிய அழித்திமைப்பின் | Wikisource; Parimelazhagar supports it. |
| 784.2 | மேற்செனறு இடித்தற் பொருட்டு. | மேற்சென்று இடித்தற் பொருட்டு. | Missing pulli (செனறு). |
| 795.2 | வல்லார்நடபு ஆய்ந்து கொளல். | வல்லார்நட்பு ஆய்ந்து கொளல். | Wikisource; Parimelazhagar supports it. |
| 812.1 | உறின்நட்டு அறினொருஉம் ஒப்பிலார் கேண்மை | உறின்நட்டு அறின்ஒரூஉம் ஒப்பிலார் கேண்மை | The extension needs a long vowel. Parimelazhagar has ஒரூஉம்; both Tamil copies have ஒருஉம். |
| 851.2 | பண்பின்மை பார஧க்கும் நோய். | பண்பின்மை பாரிக்கும் நோய். | Invalid code point. Madurai and Wikisource agree; Parimelazhagar supports it. |
| 855.2 | மிக்லூக்கும் தன்மை யவர். | மிகலூக்கும் தன்மை யவர். | Wikisource; Parimelazhagar supports it. |
| 858.2 | மிக்லூக்கின் ஊக்குமாம் கேடு. | மிகலூக்கின் ஊக்குமாம் கேடு. | க்ல is impossible in Tamil, and all three copies share it. Parimelazhagar has மிகலூக்கி னூக்குமாங். |
| 901.1 | மனைவிழைவார் மாண்பயன் எய்தார் வினைவிழையார் | மனைவிழைவார் மாண்பயன் எய்தார் வினைவிழைவார் | All three copies share this. Parimelazhagar has வினைவிழைவார், which also pairs with மனைவிழைவார். |
| 913.2 | ஏத஧ல் பிணந்தழீஇ அற்று. | ஏதில் பிணந்தழீஇ அற்று. | Invalid code point. Madurai and Wikisource agree; Parimelazhagar supports it. |
| 917.1 | நிறைநெஞ்சம் இல்லவர் தோய்வார் பிறநெஞ்சிற் | நிறைநெஞ்சம் இல்லவர் தோய்வர் பிறநெஞ்சிற் | All three copies share this. Parimelazhagar has தோய்வர். |
| 934.1 | சிறுமை பலசெய்து சீரழக்கும் சூதின் | சிறுமை பலசெய்து சீரழிக்கும் சூதின் | Madurai and Wikisource agree; Parimelazhagar supports it. |
| 943.1 | அற்றால் அறவறிந்து உண்க அஃதுடம்பு | அற்றால் அளவறிந்து உண்க அஃதுடம்பு | All three copies share this. Parimelazhagar has அளவறிந்து. |
| 957.2 | மத஧க்கண் மறுப்போல் உயர்ந்து. | மதிக்கண் மறுப்போல் உயர்ந்து. | Invalid code point. Madurai and Wikisource agree; Parimelazhagar supports it. |
| 1117.1 | அறுவாய் நிறைந்த அவிர்மதிக்குப் க்குப் போல | அறுவாய் நிறைந்த அவிர்மதிக்குப் போல | Madurai and Wikisource agree; Parimelazhagar supports it. |
| 1118.2 | காதலை வாழி மத஧. | காதலை வாழி மதி. | Invalid code point. Madurai and Wikisource agree; Parimelazhagar supports it. |
| 1126.1 | கண்ணுள்ளின் போகார் இமைப்பின் பருகுவரா | கண்ணுள்ளின் போகார் இமைப்பின் பருவரார் | All three copies share this. Parimelazhagar has பருவரார். |
| 1143.1 | உறாஅதோ ஊரறிந்த கெளவை அதனைப் | உறாஅதோ ஊரறிந்த கௌவை அதனைப் | Encoding: typed as ெ + ள instead of the vowel ௌ, which would romanise wrongly. |
| 1147.1 | ஊரவர் கெளவை எருவாக அன்னைசொல் | ஊரவர் கௌவை எருவாக அன்னைசொல் | Encoding: typed as ெ + ள instead of the vowel ௌ, which would romanise wrongly. |
| 1148.1 | நெய்யால் எரிநுதுப்பேம் என்றற்றால் கெளவையால் | நெய்யால் எரிநுதுப்பேம் என்றற்றால் கௌவையால் | Encoding: typed as ெ + ள instead of the vowel ௌ, which would romanise wrongly. |
| 1150.2 | கெளவை எடுக்கும்இவ் வூர். | கௌவை எடுக்கும்இவ் வூர். | Encoding: typed as ெ + ள instead of the vowel ௌ, which would romanise wrongly. |
| 1192.2 | வீழ்வார் அள஧ க்கும் அளி. | வீழ்வார் அளிக்கும் அளி. | Invalid code point. Madurai and Wikisource agree; Parimelazhagar supports it. |
| 1202.1 | எனைத்தொனறு இனிதேகாண் காமம்தாம் வீழ்வார் | எனைத்தொன்று இனிதேகாண் காமம்தாம் வீழ்வார் | Wikisource; Parimelazhagar supports it. |
| 1202.2 | நினைப்ப வருவதொன்று ஏல். | நினைப்ப வருவதொன்று இல். | Wikisource; Parimelazhagar supports it. |
| 1217.1 | நனவினால் நல்காக் கொடியார் கனவனால் | நனவினால் நல்காக் கொடியார் கனவினால் | All three copies share this. Parimelazhagar has கனவினால். |
| 1321.2 | வல்லது அவர்அள஧க்கு மாறு. | வல்லது அவர்அளிக்கு மாறு. | Invalid code point. Madurai and Wikisource agree; Parimelazhagar supports it. |

## Dataset kept against a disagreeing witness (19)

| Kural | Kept text | Why |
|---|---|---|
| 34.1 | மனத்துக்கண் மாசிலன் ஆதல் அனைத்தறன் | Same reading; Madurai and Wikisource only split அனைத்து அறன். |
| 49.1 | அறனெனப் பட்டதே இல்வாழ்க்கை அஃதும் | Same reading; Parimelazhagar has this joined form. |
| 50.1 | வையத்துள் வாழ்வாங்கு வாழ்பவன் வான்உறையும் | Same reading; Wikisource only joins the words. |
| 250.2 | மெலியார்மேல் செல்லு மிடத்து. | Parimelazhagar agrees with the dataset; Wikisource only splits the words. |
| 254.1 | அருளல்ல தியாதெனிற் கொல்லாமை கோறல் | Parimelazhagar has exactly this form; the others are respellings. |
| 330.1 | உயிருடம்பின் நீக்கியா ரென்ப செயிருடம்பின் | Same reading; Madurai and Wikisource only split the words. |
| 450.1 | பல்லார் பகைகொளலிற் பத்தடுத்த தீமைத்தே | கொளலிற் is right; Wikisource's கொளவிற் is a typo. |
| 895.1 | யாண்டுச்சென்று யாண்டும் உளராகார் வெந்துப்பின் | Wikisource moves வெந்துப்பின் to line 2; Parimelazhagar and Madurai agree with the dataset. |
| 895.2 | வேந்து செறப்பட் டவர். | As line 1: Wikisource's line break is wrong. |
| 1020.2 | நாணால் உயிர்மருட்டி அற்று. | Same reading; Wikisource and Parimelazhagar spell the join as யற்று. |
| 1206.1 | மற்றியான் என்னுளேன் மன்னோ அவரொடியான் | Parimelazhagar agrees (அவரொடியான்); Wikisource modernises it. |
| 1322.1 | ஊடலின் தோன்றும் சிறுதுனி நல்லளி | Parimelazhagar agrees (சிறுதுனி); Wikisource's சிறுதுணி is a typo. |
| 1323.2 | நீரியைந் தன்னார் அகத்து. | Same reading; Wikisource only divides the feet differently. |
| 1325.1 | தவறிலர் ஆயினும் தாம்வீழ்வார் மென்றோள் | Same reading; Wikisource only divides the feet differently. |
| 1325.2 | அகறலின் ஆங்கொன் றுடைத்து. | Same reading; Wikisource only divides the words differently. |
| 1327.1 | ஊடலில் தோற்றவர் வென்றார் அதுமன்னும் | Parimelazhagar agrees (அதுமன்னும்); Wikisource's அதுமுன்னும் is a typo. |
| 1327.2 | கூடலிற் காணப் படும். | Parimelazhagar agrees (கூடலிற்); Wikisource's கூடிலில் is a typo. |
| 1328.1 | ஊடிப் பெறுகுவம் கொல்லோ நுதல்வெயர்ப்பக் | Same reading; ங் is only the sandhi spelling of ம். |
| 1329.1 | ஊடுக மன்னோ ஒளியிழை யாமிரப்ப | Same reading; Wikisource only splits the word and adds punctuation. |

## Spacing only (21)

| Kural | Dataset | Proposed | Why |
|---|---|---|---|
| 42.1 | துறந்தார்க்கும் துவ்வாதவர்க்கும் இறந்தார்க்கும் | துறந்தார்க்கும் துவ்வா தவர்க்கும் இறந்தார்க்கும் | Spacing only: restores the 4 feet this line must have. |
| 60.1 | மங்கலம் என்ப மனைமாட்சி மற்று அதன் | மங்கலம் என்ப மனைமாட்சி மற்றுஅதன் | Spacing only: restores the 4 feet this line must have. |
| 70.2 | என்நோற்றான் கொல் எனும் சொல். | என்நோற்றான் கொல்எனும் சொல். | Spacing only: restores the 3 feet this line must have. |
| 82.2 | மருந்தெனினும் வேண் டற்பாற் றன்று. | மருந்தெனினும் வேண்டற்பாற் றன்று. | Stray space. Parimelazhagar confirms வேண்டற்பாற், so Wikisource's வேண்டாற்பாற் is a typo. |
| 143.2 | தீமை புரிந்து ஒழுகு வார். | தீமை புரிந்துஒழுகு வார். | Spacing only: restores the 3 feet this line must have. |
| 211.2 | என் ஆற்றுங் கொல்லோ உலகு. | என்ஆற்றுங் கொல்லோ உலகு. | Spacing only: restores the 3 feet this line must have. |
| 347.2 | பற்றி விடாஅ தவர் க்கு. | பற்றி விடாஅ தவர்க்கு. | Spacing only: restores the 3 feet this line must have. |
| 408.2 | கல்லார்கண் பட் ட திரு. | கல்லார்கண் பட்ட திரு. | Spacing only: restores the 3 feet this line must have. |
| 530.2 | இழைத் திருந்து எண்ணிக் கொளல். | இழைத்திருந்து எண்ணிக் கொளல். | Spacing only: restores the 3 feet this line must have. |
| 532.2 | நிச்ச நிரப்புக் கொன் றாங்கு. | நிச்ச நிரப்புக்கொன் றாங்கு. | Spacing only: restores the 3 feet this line must have. |
| 542.2 | கோல் நோக்கி வாழுங் குடி. | கோல்நோக்கி வாழுங் குடி. | Spacing only: restores the 3 feet this line must have. |
| 908.2 | பெட் டாங்கு ஒழுகு பவர். | பெட்டாங்கு ஒழுகு பவர். | Spacing only: restores the 3 feet this line must have. |
| 950.2 | அப்பால் நாற் கூற்றே மருந்து. | அப்பால்நாற் கூற்றே மருந்து. | Spacing only: restores the 3 feet this line must have. |
| 956.2 | குலம்பற்றி வாழ்தும் என் பார். | குலம்பற்றி வாழ்தும்என் பார். | Spacing only: restores the 3 feet this line must have. |
| 976.2 | பேணிக் கொள் வேம் என்னும் நோக்கு. | பேணிக்கொள் வேம்என்னும் நோக்கு. | Spacing only: restores the 3 feet this line must have. |
| 988.2 | திண்மை உண் டாகப் பெறின். | திண்மைஉண் டாகப் பெறின். | Spacing only: restores the 3 feet this line must have. |
| 1081.2 | மாதர்கொல் மாலும் என் நெஞ்சு. | மாதர்கொல் மாலும்என் நெஞ்சு. | Spacing only: restores the 3 feet this line must have. |
| 1129.2 | ஏதிலர் என்னும் இவ் வூர். | ஏதிலர் என்னும்இவ் வூர். | Spacing only: restores the 3 feet this line must have. |
| 1130.2 | ஏதிலர் என்னும் இவ் வூர். | ஏதிலர் என்னும்இவ் வூர். | Spacing only: restores the 3 feet this line must have. |
| 1284.2 | கூடற்கண் சென்றது என் னெஞ்சு. | கூடற்கண் சென்றதுஎன் னெஞ்சு. | Spacing only: restores the 3 feet this line must have. |
| 1307.2 | நீடுவ தன்று கொல் என்று. | நீடுவ தன்றுகொல் என்று. | Spacing only: restores the 3 feet this line must have. |

## Alignment of Aiyar with the Tamil

Numbering alone doesn't prove the order matches inside a chapter, so each chapter's couplets were matched against
a reference English by meaning, using bge-m3 embeddings. 127 of 133 chapters paired exactly by number. The 13
couplets in question (chapters 16, 29, 50, 69, 72, 92) were then read against the Tamil, and the numbering was right
every time. Comparing Aiyar with the Tamil directly did not work: the model handles classical Tamil poorly.

## What this review can't promise

- An error shared by every copy, in a valid word, is only caught where a check compares it with Parimelazhagar's
  text, and these checks did not catch everything. K262 and K689 passed them and were found only when the readings
  were written from his commentary. A later scan of every word against his gloss found no others, but it can't
  separate a real variant from a slip in the Wikisource edition.
- The word check reads the inside of each word, so a wrong first or last letter can slip past it.
- Choosing between genuine readings is a scholarly judgement. Those two were decided by the reviewer.
