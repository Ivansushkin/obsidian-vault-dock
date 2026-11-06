import type { PaletteName } from "./placeholder-colors";

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
	uploadImage: "Upload image",
	changeImage: "Change image",
	removeImage: "Remove image",
	chooseColor: "Choose color",
	placeholderColorDescription:
		"If this tile has an image, applying colors replaces it with a placeholder.",
	placeholderBackground: "Background",
	placeholderText: "Text",
	applyColor: "Apply",
	cancelColor: "Cancel",
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
	invalidImage: "The selected image has an unsupported format or size.",
	saveImageFailed: "Could not update the vault image. Try again.",
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
		uploadImage: "Загрузить картинку",
		changeImage: "Сменить картинку",
		removeImage: "Удалить картинку",
		chooseColor: "Выбрать цвет",
		placeholderColorDescription:
			"Если у плитки есть картинка, применение цветов заменит её заглушкой.",
		placeholderBackground: "Фон",
		placeholderText: "Текст",
		applyColor: "Применить",
		cancelColor: "Отмена",
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
		invalidImage: "Формат или размер выбранной картинки не поддерживается.",
		saveImageFailed:
			"Не удалось обновить картинку хранилища. Попробуйте снова.",
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
		uploadImage: "Суретті жүктеу",
		changeImage: "Суретті ауыстыру",
		removeImage: "Суретті жою",
		chooseColor: "Түс таңдау",
		placeholderColorDescription:
			"Плиткада сурет болса, түстерді қолданғанда оның орнына әріптер көрсетіледі.",
		placeholderBackground: "Фон",
		placeholderText: "Мәтін",
		applyColor: "Қолдану",
		cancelColor: "Бас тарту",
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
		invalidImage:
			"Таңдалған суреттің пішімі немесе өлшемі қолдау таппайды.",
		saveImageFailed:
			"Қойма суретін жаңарту мүмкін болмады. Қайталап көріңіз.",
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
		uploadImage: "Загрузіць выяву",
		changeImage: "Змяніць выяву",
		removeImage: "Выдаліць выяву",
		chooseColor: "Выбраць колер",
		placeholderColorDescription:
			"Калі на плітцы ёсць выява, пасля прымянення колераў яе заменяць ініцыялы.",
		placeholderBackground: "Фон",
		placeholderText: "Тэкст",
		applyColor: "Прымяніць",
		cancelColor: "Скасаваць",
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
		invalidImage: "Фармат або памер выбранай выявы не падтрымліваецца.",
		saveImageFailed:
			"Не ўдалося абнавіць выяву сховішча. Паспрабуйце зноў.",
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
		uploadImage: "Rasm yuklash",
		changeImage: "Rasmni almashtirish",
		removeImage: "Rasmni o‘chirish",
		chooseColor: "Rang tanlash",
		placeholderColorDescription:
			"Agar plitkada rasm bo‘lsa, ranglarni qo‘llash uni bosh harflar bilan almashtiradi.",
		placeholderBackground: "Fon",
		placeholderText: "Matn",
		applyColor: "Qo‘llash",
		cancelColor: "Bekor qilish",
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
		invalidImage:
			"Tanlangan rasm formati yoki hajmi qo‘llab-quvvatlanmaydi.",
		saveImageFailed:
			"Ombor rasmini yangilab bo‘lmadi. Qayta urinib ko‘ring.",
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
		uploadImage: "上传图片",
		changeImage: "更换图片",
		removeImage: "移除图片",
		chooseColor: "选择颜色",
		placeholderColorDescription:
			"如果磁贴有图片，应用颜色后将用首字母占位图替换它。",
		placeholderBackground: "背景",
		placeholderText: "文字",
		applyColor: "应用",
		cancelColor: "取消",
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
		invalidImage: "不支持所选图片的格式，或图片文件过大。",
		saveImageFailed: "无法更新仓库图标。请重试。",
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
		uploadImage: "上傳圖片",
		changeImage: "更換圖片",
		removeImage: "移除圖片",
		chooseColor: "選擇顏色",
		placeholderColorDescription:
			"如果圖塊有圖片，套用顏色後會以首字母預留圖示取代它。",
		placeholderBackground: "背景",
		placeholderText: "文字",
		applyColor: "套用",
		cancelColor: "取消",
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
		invalidImage: "不支援所選圖片的格式，或圖片檔案過大。",
		saveImageFailed: "無法更新儲存庫圖示。請再試一次。",
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
		uploadImage: "画像をアップロード",
		changeImage: "画像を変更",
		removeImage: "画像を削除",
		chooseColor: "色を選択",
		placeholderColorDescription:
			"タイルに画像がある場合、色を適用するとイニシャル表示に切り替わります。",
		placeholderBackground: "背景",
		placeholderText: "文字",
		applyColor: "適用",
		cancelColor: "キャンセル",
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
		invalidImage:
			"選択した画像の形式に対応していないか、ファイルサイズが大きすぎます。",
		saveImageFailed:
			"保管庫のアイコンを更新できませんでした。もう一度お試しください。",
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
