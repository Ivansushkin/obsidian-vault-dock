import type { PaletteName } from "./placeholder-colors";
import type { PresetId } from "./tile-presets";

export const LANGUAGE_NAMES = {
	en: "English",
	ru: "Русский",
	kk: "Қазақша",
	be: "Беларуская",
	uz: "O‘zbekcha",
	zh: "简体中文",
	"zh-TW": "繁體中文",
	ja: "日本語",
};

type Language = keyof typeof LANGUAGE_NAMES;
export type LanguagePreference = "system" | Language;

export function isLanguagePreference(
	value: unknown,
): value is LanguagePreference {
	return (
		value === "system" ||
		(typeof value === "string" && Object.hasOwn(LANGUAGE_NAMES, value))
	);
}

const en = {
	mobileSwitchFailed: "Could not open the vault.",
	generalSettings: "General",
	language: "Interface language",
	languageDescription:
		"Follow Obsidian’s language or choose a language for this plugin. Changes apply across vaults.",
	systemLanguage: "System default",
	switchingMode: "Switching mode",
	switchingModeDescription:
		"Important. This mode also applies to Obsidian’s built-in vault switcher. A hidden window keeps its tabs. If Vault Dock is inactive in the destination vault, the current window closes instead of being hidden.",
	closeCurrentWindow: "Close current window",
	hideCurrentWindow: "Hide current window",
	keepBothWindowsOpen: "Keep both windows open",
	shareSettings: "Share settings across vaults",
	shareSettingsDescription:
		"Turning this on replaces the shared switching mode and tile images with the settings from this vault.",
	hideLabels: "Hide vault labels",
	hideLabelsDescription:
		"Show square tiles across all vaults in this profile.",
	barPosition: "Bar position",
	barPositionDescription:
		"Choose where to show the bar across all vaults in this profile.",
	barTop: "Top",
	barBottom: "Bottom",
	barLeft: "Left",
	barRight: "Right",
	tileScale: "Tile size",
	tileScaleDescription:
		"Adjust the size of tiles with and without labels. You can also drag the edge of the bar.",
	vaults: "Vaults",
	chooseImageFile: "Choose file…",
	removeImage: "Remove picture",
	tileImage: "Picture",
	appearancePreview: "Preview",
	initialsHint: "Choosing a color shows the initials.",
	checkingImage: "Checking image…",
	invalidImage:
		"Could not open the image. Choose a PNG, JPEG, or WebP file up to 512 KB.",
	appearanceScopeChanged:
		"Shared settings changed. Reopen Tile appearance to edit the current settings.",
	tileAppearance: "Tile appearance",
	tilePresets: "Ready-made pictures",
	tileInitials: "Initials",
	moveVaultEarlier: "Move earlier",
	moveVaultLater: "Move later",
	presetNames: {
		book: "Book",
		briefcase: "Briefcase",
		code: "Code",
		compass: "Compass",
		flask: "Flask",
		home: "Home",
		music: "Music",
		spark: "Spark",
	} satisfies Record<PresetId, string>,
	placeholderBackground: "Background",
	placeholderText: "Text",
	applyAppearance: "Apply",
	cancelAppearance: "Cancel",
	colorNames: {
		transparent: "No color",
		white: "White",
		black: "Black",
		gray: "Gray",
		navy: "Navy",
		red: "Red",
		orange: "Orange",
		yellow: "Yellow",
		green: "Green",
		teal: "Teal",
		blue: "Blue",
		purple: "Purple",
		pink: "Pink",
	} satisfies Record<PaletteName, string>,
	desktopUnavailable: "The desktop window bridge is unavailable.",
	settingsUnavailable: "Reload the open vaults to retry loading settings.",
	registryUnavailable: "Could not read the registered vaults.",
	switchTimeout: "Switching vaults took too long. Try again.",
	switchBusy: "A vault switch is already in progress.",
	switchFailed: "Could not switch vaults in the current window state.",
	saveSettingsFailed: "Could not update vault switcher settings. Try again.",
	settingsLoading: "Vault switcher settings are still loading. Try again.",
};

type Messages = typeof en;
export type Translate = <Key extends keyof Messages>(key: Key) => Messages[Key];

const messages: Record<Language, Messages> = {
	en,
	ru: {
		mobileSwitchFailed: "Не удалось открыть хранилище.",
		generalSettings: "Общие",
		language: "Язык интерфейса",
		languageDescription:
			"Используйте язык Obsidian или выберите язык плагина. Изменение применяется во всех хранилищах.",
		systemLanguage: "Как в Obsidian",
		switchingMode: "Режим переключения",
		switchingModeDescription:
			"Важно. Этот режим также действует при переключении хранилищ через штатное меню Obsidian. Скрытое окно сохраняет вкладки. Если в выбранном хранилище плагин не включён, текущее окно закрывается вместо скрытия.",
		closeCurrentWindow: "Закрывать текущее окно",
		hideCurrentWindow: "Скрывать текущее окно",
		keepBothWindowsOpen: "Оставлять оба окна открытыми",
		shareSettings: "Общие настройки для всех хранилищ",
		shareSettingsDescription:
			"При включении общий режим переключения и картинки плиток заменяются настройками из этого хранилища.",
		hideLabels: "Скрывать подписи хранилищ",
		hideLabelsDescription:
			"Показывать квадратные плитки во всех хранилищах этого профиля.",
		barPosition: "Положение панели",
		barPositionDescription:
			"Выберите расположение панели во всех хранилищах этого профиля.",
		barTop: "Сверху",
		barBottom: "Снизу",
		barLeft: "Слева",
		barRight: "Справа",
		tileScale: "Размер плиток",
		tileScaleDescription:
			"Изменяйте размер плиток с подписями и без них. Можно также перетаскивать край панели.",
		vaults: "Хранилища",
		chooseImageFile: "Выбрать файл…",
		removeImage: "Убрать картинку",
		tileImage: "Картинка",
		appearancePreview: "Предпросмотр",
		initialsHint: "Выбор цвета показывает инициалы.",
		checkingImage: "Проверяем картинку…",
		invalidImage:
			"Не удалось открыть картинку. Выберите PNG, JPEG или WebP до 512 КБ.",
		appearanceScopeChanged:
			"Область настроек изменилась. Переоткройте «Оформление плитки», чтобы изменить текущие настройки.",
		tileAppearance: "Оформление плитки",
		tilePresets: "Готовые картинки",
		tileInitials: "Инициалы",
		moveVaultEarlier: "Переместить раньше",
		moveVaultLater: "Переместить позже",
		presetNames: {
			book: "Книга",
			briefcase: "Портфель",
			code: "Код",
			compass: "Компас",
			flask: "Колба",
			home: "Дом",
			music: "Музыка",
			spark: "Искра",
		},
		placeholderBackground: "Фон",
		placeholderText: "Текст",
		applyAppearance: "Применить",
		cancelAppearance: "Отмена",
		colorNames: {
			transparent: "Без цвета",
			white: "Белый",
			black: "Чёрный",
			gray: "Серый",
			navy: "Тёмно-синий",
			red: "Красный",
			orange: "Оранжевый",
			yellow: "Жёлтый",
			green: "Зелёный",
			teal: "Бирюзовый",
			blue: "Синий",
			purple: "Фиолетовый",
			pink: "Розовый",
		},
		desktopUnavailable: "Интерфейс управления окнами Obsidian недоступен.",
		settingsUnavailable:
			"Перезагрузите открытые хранилища, чтобы повторить загрузку настроек.",
		registryUnavailable:
			"Не удалось получить список зарегистрированных хранилищ.",
		switchTimeout:
			"Переключение хранилища заняло слишком много времени. Попробуйте снова.",
		switchBusy: "Переключение хранилища уже выполняется.",
		switchFailed:
			"Не удалось переключить хранилище в текущем состоянии окна.",
		saveSettingsFailed:
			"Не удалось сохранить настройки Vault Dock. Попробуйте снова.",
		settingsLoading:
			"Настройки Vault Dock ещё загружаются. Попробуйте снова.",
	},
	kk: {
		mobileSwitchFailed: "Хранилищені ашу мүмкін болмады.",
		generalSettings: "Жалпы",
		language: "Интерфейс тілі",
		languageDescription:
			"Obsidian тілін қолданыңыз немесе плагин тілін таңдаңыз. Өзгеріс барлық қоймаға қолданылады.",
		systemLanguage: "Obsidian тілі",
		switchingMode: "Ауысу режимі",
		switchingModeDescription:
			"Маңызды. Бұл режим Obsidian-ның кіріктірілген қойма ауыстырғышына да қолданылады. Жасырылған терезенің қойындылары сақталады. Таңдалған қоймада плагин қосылмаған болса, ағымдағы терезе жасырылмай, жабылады.",
		closeCurrentWindow: "Ағымдағы терезені жабу",
		hideCurrentWindow: "Ағымдағы терезені жасыру",
		keepBothWindowsOpen: "Екі терезені де ашық қалдыру",
		shareSettings: "Барлық қоймаға ортақ баптаулар",
		shareSettingsDescription:
			"Қосылғанда осы қойманың ауысу режимі мен тақташа суреттері ортақ баптаулардың орнына қолданылады.",
		hideLabels: "Қойма атауларын жасыру",
		hideLabelsDescription:
			"Осы профильдегі барлық қоймада шаршы тақташаларды көрсету.",
		barPosition: "Панельдің орналасуы",
		barPositionDescription:
			"Осы профильдегі барлық қойма үшін панельдің орналасуын таңдаңыз.",
		barTop: "Жоғарыда",
		barBottom: "Төменде",
		barLeft: "Сол жақта",
		barRight: "Оң жақта",
		tileScale: "Тақташалардың өлшемі",
		tileScaleDescription:
			"Атаулары бар және жоқ тақташалардың өлшемін өзгертіңіз. Панельдің жиегін сүйреуге де болады.",
		vaults: "Қоймалар",
		chooseImageFile: "Файл таңдау…",
		removeImage: "Суретті алып тастау",
		tileImage: "Сурет",
		appearancePreview: "Алдын ала қарау",
		initialsHint: "Түс таңдағанда бас әріптер көрсетіледі.",
		checkingImage: "Сурет тексерілуде…",
		invalidImage:
			"Сурет ашылмады. Көлемі 512 КБ-тан аспайтын PNG, JPEG немесе WebP файлын таңдаңыз.",
		appearanceScopeChanged:
			"Ортақ баптау режимі өзгерді. Ағымдағы баптауларды өзгерту үшін тақташа көрінісін қайта ашыңыз.",
		tileAppearance: "Тақташаның көрінісі",
		tilePresets: "Дайын суреттер",
		tileInitials: "Бас әріптер",
		moveVaultEarlier: "Алға жылжыту",
		moveVaultLater: "Артқа жылжыту",
		presetNames: {
			book: "Кітап",
			briefcase: "Портфель",
			code: "Код",
			compass: "Компас",
			flask: "Колба",
			home: "Үй",
			music: "Музыка",
			spark: "Ұшқын",
		},
		placeholderBackground: "Фон",
		placeholderText: "Мәтін",
		applyAppearance: "Қолдану",
		cancelAppearance: "Бас тарту",
		colorNames: {
			transparent: "Түссіз",
			white: "Ақ",
			black: "Қара",
			gray: "Сұр",
			navy: "Қою көк",
			red: "Қызыл",
			orange: "Қызғылт сары",
			yellow: "Сары",
			green: "Жасыл",
			teal: "Көгілдір жасыл",
			blue: "Көк",
			purple: "Күлгін",
			pink: "Қызғылт",
		},
		desktopUnavailable:
			"Obsidian терезелерін басқару интерфейсі қолжетімсіз.",
		settingsUnavailable:
			"Баптауларды қайта жүктеу үшін ашық қоймаларды қайта жүктеңіз.",
		registryUnavailable: "Тіркелген қоймалар тізімін алу мүмкін болмады.",
		switchTimeout: "Қойманы ауыстыру тым ұзаққа созылды. Қайталап көріңіз.",
		switchBusy: "Қойма ауыстырылып жатыр.",
		switchFailed:
			"Терезенің ағымдағы күйінде қойманы ауыстыру мүмкін болмады.",
		saveSettingsFailed:
			"Vault Dock баптауларын сақтау мүмкін болмады. Қайталап көріңіз.",
		settingsLoading:
			"Vault Dock баптаулары әлі жүктелуде. Қайталап көріңіз.",
	},
	be: {
		mobileSwitchFailed: "Не ўдалося адкрыць сховішча.",
		generalSettings: "Агульныя",
		language: "Мова інтэрфейсу",
		languageDescription:
			"Выкарыстоўвайце мову Obsidian або выберыце мову плагіна. Змена ўжываецца ва ўсіх сховішчах.",
		systemLanguage: "Як у Obsidian",
		switchingMode: "Рэжым пераключэння",
		switchingModeDescription:
			"Важна. Гэты рэжым таксама дзейнічае пры пераключэнні сховішчаў праз убудаванае меню Obsidian. Схаванае акно захоўвае ўкладкі. Калі ў выбраным сховішчы плагін не ўключаны, бягучае акно закрываецца замест таго, каб схавацца.",
		closeCurrentWindow: "Закрываць бягучае акно",
		hideCurrentWindow: "Хаваць бягучае акно",
		keepBothWindowsOpen: "Пакідаць абодва акны адкрытымі",
		shareSettings: "Агульныя налады для ўсіх сховішчаў",
		shareSettingsDescription:
			"Пры ўключэнні агульны рэжым пераключэння і выявы плітак замяняюцца наладамі гэтага сховішча.",
		hideLabels: "Хаваць подпісы сховішчаў",
		hideLabelsDescription:
			"Паказваць квадратныя пліткі ва ўсіх сховішчах гэтага профілю.",
		barPosition: "Размяшчэнне панэлі",
		barPositionDescription:
			"Выберыце размяшчэнне панэлі ва ўсіх сховішчах гэтага профілю.",
		barTop: "Уверсе",
		barBottom: "Унізе",
		barLeft: "Злева",
		barRight: "Справа",
		tileScale: "Памер плітак",
		tileScaleDescription:
			"Змяняйце памер плітак з подпісамі і без іх. Можна таксама перацягнуць край панэлі.",
		vaults: "Сховішчы",
		chooseImageFile: "Выбраць файл…",
		removeImage: "Прыбраць выяву",
		tileImage: "Выява",
		appearancePreview: "Папярэдні прагляд",
		initialsHint: "Выбар колеру паказвае ініцыялы.",
		checkingImage: "Праверка выявы…",
		invalidImage:
			"Не ўдалося адкрыць выяву. Выберыце файл PNG, JPEG або WebP памерам да 512 КБ.",
		appearanceScopeChanged:
			"Рэжым агульных налад змяніўся. Адкрыйце афармленне пліткі зноў, каб змяніць бягучыя налады.",
		tileAppearance: "Афармленне пліткі",
		tilePresets: "Гатовыя выявы",
		tileInitials: "Ініцыялы",
		moveVaultEarlier: "Перамясціць раней",
		moveVaultLater: "Перамясціць пазней",
		presetNames: {
			book: "Кніга",
			briefcase: "Партфель",
			code: "Код",
			compass: "Компас",
			flask: "Колба",
			home: "Дом",
			music: "Музыка",
			spark: "Іскра",
		},
		placeholderBackground: "Фон",
		placeholderText: "Тэкст",
		applyAppearance: "Прымяніць",
		cancelAppearance: "Скасаваць",
		colorNames: {
			transparent: "Без колеру",
			white: "Белы",
			black: "Чорны",
			gray: "Шэры",
			navy: "Цёмна-сіні",
			red: "Чырвоны",
			orange: "Аранжавы",
			yellow: "Жоўты",
			green: "Зялёны",
			teal: "Бірузовы",
			blue: "Сіні",
			purple: "Фіялетавы",
			pink: "Ружовы",
		},
		desktopUnavailable: "Інтэрфейс кіравання вокнамі Obsidian недаступны.",
		settingsUnavailable:
			"Перазагрузіце адкрытыя сховішчы, каб паўтарыць загрузку налад.",
		registryUnavailable:
			"Не ўдалося атрымаць спіс зарэгістраваных сховішчаў.",
		switchTimeout:
			"Пераключэнне сховішча заняло зашмат часу. Паспрабуйце зноў.",
		switchBusy: "Сховішча ўжо пераключаецца.",
		switchFailed: "Не ўдалося пераключыць сховішча ў бягучым стане акна.",
		saveSettingsFailed:
			"Не ўдалося захаваць налады Vault Dock. Паспрабуйце зноў.",
		settingsLoading:
			"Налады Vault Dock яшчэ загружаюцца. Паспрабуйце зноў.",
	},
	uz: {
		mobileSwitchFailed: "Omborni ochib bo‘lmadi.",
		generalSettings: "Umumiy",
		language: "Interfeys tili",
		languageDescription:
			"Obsidian tilidan foydalaning yoki plagin tilini tanlang. O‘zgarish barcha omborlarda qo‘llanadi.",
		systemLanguage: "Obsidian tili",
		switchingMode: "Almashish rejimi",
		switchingModeDescription:
			"Muhim. Bu rejim Obsidian’ning ichki ombor almashtirgichiga ham tatbiq etiladi. Yashirilgan oynadagi varaqlar saqlanadi. Tanlangan omborda plagin yoqilmagan bo‘lsa, joriy oyna yashirilish o‘rniga yopiladi.",
		closeCurrentWindow: "Joriy oynani yopish",
		hideCurrentWindow: "Joriy oynani yashirish",
		keepBothWindowsOpen: "Ikkala oynani ham ochiq qoldirish",
		shareSettings: "Barcha omborlar uchun umumiy sozlamalar",
		shareSettingsDescription:
			"Bu sozlama yoqilganda joriy omborning almashish rejimi va plitka rasmlari umumiy sozlamalarni almashtiradi.",
		hideLabels: "Ombor nomlarini yashirish",
		hideLabelsDescription:
			"Ushbu profildagi barcha omborlarda kvadrat plitkalarni ko‘rsatish.",
		barPosition: "Panel joylashuvi",
		barPositionDescription:
			"Ushbu profildagi barcha omborlar uchun panel joylashuvini tanlang.",
		barTop: "Yuqorida",
		barBottom: "Pastda",
		barLeft: "Chapda",
		barRight: "O‘ngda",
		tileScale: "Plitka o‘lchami",
		tileScaleDescription:
			"Nomli va nomsiz plitkalar o‘lchamini sozlang. Panel chetini sudrash ham mumkin.",
		vaults: "Omborlar",
		chooseImageFile: "Fayl tanlash…",
		removeImage: "Rasmni olib tashlash",
		tileImage: "Rasm",
		appearancePreview: "Oldindan ko‘rish",
		initialsHint: "Rang tanlansa, bosh harflar ko‘rsatiladi.",
		checkingImage: "Rasm tekshirilmoqda…",
		invalidImage:
			"Rasmni ochib bo‘lmadi. 512 KB gacha bo‘lgan PNG, JPEG yoki WebP faylini tanlang.",
		appearanceScopeChanged:
			"Umumiy sozlamalar rejimi o‘zgardi. Joriy sozlamalarni tahrirlash uchun katak ko‘rinishini qayta oching.",
		tileAppearance: "Katak ko‘rinishi",
		tilePresets: "Tayyor rasmlar",
		tileInitials: "Bosh harflar",
		moveVaultEarlier: "Oldinga siljitish",
		moveVaultLater: "Orqaga siljitish",
		presetNames: {
			book: "Kitob",
			briefcase: "Portfel",
			code: "Kod",
			compass: "Kompas",
			flask: "Kolba",
			home: "Uy",
			music: "Musiqa",
			spark: "Uchqun",
		},
		placeholderBackground: "Fon",
		placeholderText: "Matn",
		applyAppearance: "Qo‘llash",
		cancelAppearance: "Bekor qilish",
		colorNames: {
			transparent: "Rangsiz",
			white: "Oq",
			black: "Qora",
			gray: "Kulrang",
			navy: "To‘q ko‘k",
			red: "Qizil",
			orange: "To‘q sariq",
			yellow: "Sariq",
			green: "Yashil",
			teal: "Feruza",
			blue: "Ko‘k",
			purple: "Binafsha",
			pink: "Pushti",
		},
		desktopUnavailable:
			"Obsidian oynalarini boshqarish interfeysi mavjud emas.",
		settingsUnavailable:
			"Sozlamalarni qayta yuklash uchun ochiq omborlarni qayta yuklang.",
		registryUnavailable:
			"Ro‘yxatdan o‘tgan omborlar ro‘yxatini olib bo‘lmadi.",
		switchTimeout:
			"Omborni almashtirish juda uzoq davom etdi. Qayta urinib ko‘ring.",
		switchBusy: "Ombor almashtirilmoqda.",
		switchFailed: "Oynaning joriy holatida omborni almashtirib bo‘lmadi.",
		saveSettingsFailed:
			"Vault Dock sozlamalarini saqlab bo‘lmadi. Qayta urinib ko‘ring.",
		settingsLoading:
			"Vault Dock sozlamalari hali yuklanmoqda. Qayta urinib ko‘ring.",
	},
	zh: {
		mobileSwitchFailed: "无法打开仓库。",
		generalSettings: "常规",
		language: "界面语言",
		languageDescription:
			"跟随 Obsidian 的语言设置，或为此插件单独选择语言。此设置适用于所有仓库。",
		systemLanguage: "跟随 Obsidian",
		switchingMode: "切换方式",
		switchingModeDescription:
			"请注意，此模式也适用于 Obsidian 内置的仓库切换器。隐藏的窗口会保留其标签页。如果目标仓库未启用此插件，当前窗口将关闭而非隐藏。",
		closeCurrentWindow: "关闭当前窗口",
		hideCurrentWindow: "隐藏当前窗口",
		keepBothWindowsOpen: "保持两个窗口都打开",
		shareSettings: "在所有仓库间共享设置",
		shareSettingsDescription:
			"启用后，将用当前仓库的切换方式和仓库图标覆盖共享设置。",
		hideLabels: "隐藏仓库名称",
		hideLabelsDescription: "在此配置文件的所有仓库中显示方形磁贴。",
		barPosition: "切换栏位置",
		barPositionDescription: "选择此配置文件中所有仓库的切换栏位置。",
		barTop: "顶部",
		barBottom: "底部",
		barLeft: "左侧",
		barRight: "右侧",
		tileScale: "磁贴大小",
		tileScaleDescription:
			"调整有标签和无标签的磁贴大小。也可以拖动切换栏边缘。",
		vaults: "仓库",
		chooseImageFile: "选择文件…",
		removeImage: "移除图片",
		tileImage: "图片",
		appearancePreview: "预览",
		initialsHint: "选择颜色会显示首字母。",
		checkingImage: "正在检查图片…",
		invalidImage:
			"无法打开图片。请选择不超过 512 KB 的 PNG、JPEG 或 WebP 文件。",
		appearanceScopeChanged:
			"共享设置模式已更改。请重新打开磁贴外观以编辑当前设置。",
		tileAppearance: "磁贴外观",
		tilePresets: "预设图片",
		tileInitials: "首字母",
		moveVaultEarlier: "向前移动",
		moveVaultLater: "向后移动",
		presetNames: {
			book: "书本",
			briefcase: "公文包",
			code: "代码",
			compass: "指南针",
			flask: "烧瓶",
			home: "房屋",
			music: "音乐",
			spark: "火花",
		},
		placeholderBackground: "背景",
		placeholderText: "文字",
		applyAppearance: "应用",
		cancelAppearance: "取消",
		colorNames: {
			transparent: "无颜色",
			white: "白色",
			black: "黑色",
			gray: "灰色",
			navy: "深蓝色",
			red: "红色",
			orange: "橙色",
			yellow: "黄色",
			green: "绿色",
			teal: "青绿色",
			blue: "蓝色",
			purple: "紫色",
			pink: "粉色",
		},
		desktopUnavailable: "无法使用 Obsidian 的窗口控制功能。",
		settingsUnavailable: "无法加载设置。请重新加载已打开的仓库后再试。",
		registryUnavailable: "无法读取已登记的仓库列表。",
		switchTimeout: "切换仓库超时，请重试。",
		switchBusy: "正在切换仓库，请稍候。",
		switchFailed: "在当前窗口状态下无法切换仓库。",
		saveSettingsFailed: "无法保存 Vault Dock 的设置。请重试。",
		settingsLoading: "Vault Dock 的设置仍在加载，请稍后重试。",
	},
	"zh-TW": {
		mobileSwitchFailed: "無法開啟儲存庫。",
		generalSettings: "一般",
		language: "介面語言",
		languageDescription:
			"沿用 Obsidian 的語言設定，或單獨為此外掛程式選擇語言。此設定適用於所有儲存庫。",
		systemLanguage: "沿用 Obsidian 的語言",
		switchingMode: "切換方式",
		switchingModeDescription:
			"請注意，此模式也適用於 Obsidian 內建的儲存庫切換器。隱藏的視窗會保留其分頁。如果目標儲存庫未啟用此外掛程式，目前的視窗將關閉而非隱藏。",
		closeCurrentWindow: "關閉目前的視窗",
		hideCurrentWindow: "隱藏目前的視窗",
		keepBothWindowsOpen: "保持兩個視窗都開啟",
		shareSettings: "在所有儲存庫之間共用設定",
		shareSettingsDescription:
			"啟用後，將以目前儲存庫的切換方式與儲存庫圖示覆寫共用設定。",
		hideLabels: "隱藏儲存庫名稱",
		hideLabelsDescription: "在此設定檔的所有儲存庫中顯示方形圖塊。",
		barPosition: "切換列位置",
		barPositionDescription: "選擇此設定檔中所有儲存庫的切換列位置。",
		barTop: "頂部",
		barBottom: "底部",
		barLeft: "左側",
		barRight: "右側",
		tileScale: "圖塊大小",
		tileScaleDescription:
			"調整有標籤和無標籤的圖塊大小。也可以拖曳切換列邊緣。",
		vaults: "儲存庫",
		chooseImageFile: "選擇檔案…",
		removeImage: "移除圖片",
		tileImage: "圖片",
		appearancePreview: "預覽",
		initialsHint: "選擇顏色會顯示首字母。",
		checkingImage: "正在檢查圖片…",
		invalidImage:
			"無法開啟圖片。請選擇不超過 512 KB 的 PNG、JPEG 或 WebP 檔案。",
		appearanceScopeChanged:
			"共用設定模式已變更。請重新開啟磚塊外觀以編輯目前設定。",
		tileAppearance: "磚塊外觀",
		tilePresets: "預設圖片",
		tileInitials: "首字母",
		moveVaultEarlier: "向前移動",
		moveVaultLater: "向後移動",
		presetNames: {
			book: "書本",
			briefcase: "公事包",
			code: "程式碼",
			compass: "指南針",
			flask: "燒瓶",
			home: "房屋",
			music: "音樂",
			spark: "火花",
		},
		placeholderBackground: "背景",
		placeholderText: "文字",
		applyAppearance: "套用",
		cancelAppearance: "取消",
		colorNames: {
			transparent: "無顏色",
			white: "白色",
			black: "黑色",
			gray: "灰色",
			navy: "深藍色",
			red: "紅色",
			orange: "橙色",
			yellow: "黃色",
			green: "綠色",
			teal: "藍綠色",
			blue: "藍色",
			purple: "紫色",
			pink: "粉紅色",
		},
		desktopUnavailable: "無法使用 Obsidian 的視窗控制功能。",
		settingsUnavailable:
			"無法載入設定。請重新載入已開啟的儲存庫後再試一次。",
		registryUnavailable: "無法讀取已登錄的儲存庫清單。",
		switchTimeout: "切換儲存庫逾時，請再試一次。",
		switchBusy: "正在切換儲存庫，請稍候。",
		switchFailed: "在目前的視窗狀態下無法切換儲存庫。",
		saveSettingsFailed: "無法儲存 Vault Dock 的設定。請再試一次。",
		settingsLoading: "Vault Dock 的設定仍在載入，請稍後再試。",
	},
	ja: {
		mobileSwitchFailed: "保管庫を開けませんでした。",
		generalSettings: "一般",
		language: "表示言語",
		languageDescription:
			"Obsidianの表示言語に合わせるか、このプラグインの言語を選べます。設定はすべての保管庫に適用されます。",
		systemLanguage: "Obsidianの言語に合わせる",
		switchingMode: "切り替えモード",
		switchingModeDescription:
			"ご注意ください。このモードは Obsidian 標準の保管庫切り替えにも適用されます。非表示にしたウィンドウのタブは保持されます。切り替え先でプラグインが無効な場合、現在のウィンドウは閉じられます。",
		closeCurrentWindow: "現在のウィンドウを閉じる",
		hideCurrentWindow: "現在のウィンドウを非表示にする",
		keepBothWindowsOpen: "両方のウィンドウを開いたままにする",
		shareSettings: "保管庫間で設定を共有",
		shareSettingsDescription:
			"オンにすると、共有設定の切り替えモードとアイコンを現在の保管庫の設定で上書きします。",
		hideLabels: "保管庫名を非表示",
		hideLabelsDescription:
			"このプロファイルのすべての保管庫で正方形のタイルを表示します。",
		barPosition: "切り替えバーの位置",
		barPositionDescription:
			"このプロファイルのすべての保管庫での表示位置を選択します。",
		barTop: "上",
		barBottom: "下",
		barLeft: "左",
		barRight: "右",
		tileScale: "タイルのサイズ",
		tileScaleDescription:
			"ラベルの有無にかかわらずタイルのサイズを調整します。バーの端をドラッグすることもできます。",
		vaults: "保管庫",
		chooseImageFile: "ファイルを選択…",
		removeImage: "画像を取り除く",
		tileImage: "画像",
		appearancePreview: "プレビュー",
		initialsHint: "色を選ぶとイニシャルが表示されます。",
		checkingImage: "画像を確認中…",
		invalidImage:
			"画像を開けませんでした。512 KB 以下の PNG、JPEG、WebP ファイルを選択してください。",
		appearanceScopeChanged:
			"設定の共有モードが変更されました。タイルの外観を開き直して現在の設定を編集してください。",
		tileAppearance: "タイルの外観",
		tilePresets: "プリセット画像",
		tileInitials: "イニシャル",
		moveVaultEarlier: "前へ移動",
		moveVaultLater: "後ろへ移動",
		presetNames: {
			book: "本",
			briefcase: "かばん",
			code: "コード",
			compass: "コンパス",
			flask: "フラスコ",
			home: "家",
			music: "音楽",
			spark: "きらめき",
		},
		placeholderBackground: "背景",
		placeholderText: "文字",
		applyAppearance: "適用",
		cancelAppearance: "キャンセル",
		colorNames: {
			transparent: "色なし",
			white: "白",
			black: "黒",
			gray: "グレー",
			navy: "紺",
			red: "赤",
			orange: "オレンジ",
			yellow: "黄",
			green: "緑",
			teal: "青緑",
			blue: "青",
			purple: "紫",
			pink: "ピンク",
		},
		desktopUnavailable: "Obsidianのウィンドウ操作機能を利用できません。",
		settingsUnavailable:
			"設定を読み込めませんでした。開いている保管庫を再読み込みしてから、もう一度お試しください。",
		registryUnavailable: "登録済みの保管庫の一覧を取得できませんでした。",
		switchTimeout:
			"保管庫の切り替えがタイムアウトしました。もう一度お試しください。",
		switchBusy: "保管庫を切り替えています。しばらくお待ちください。",
		switchFailed: "現在のウィンドウの状態では保管庫を切り替えられません。",
		saveSettingsFailed:
			"Vault Dockの設定を保存できませんでした。もう一度お試しください。",
		settingsLoading:
			"Vault Dockの設定を読み込み中です。しばらくしてから、もう一度お試しください。",
	},
};

/** Resolve automatic selection from Obsidian's locale, with English as a fallback. */
export function getMessages(
	preference: LanguagePreference,
	obsidianLanguage: string,
): Messages {
	if (preference !== "system") {
		return messages[preference];
	}
	const [language, variant] = obsidianLanguage.toLowerCase().split(/[-_]/);
	if (language === "zh" && (variant === "tw" || variant === "hant")) {
		return messages["zh-TW"];
	}
	return isLanguagePreference(language) && language !== "system"
		? messages[language]
		: messages.en;
}
