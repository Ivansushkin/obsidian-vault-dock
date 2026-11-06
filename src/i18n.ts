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
	language: "Interface language",
	languageDescription:
		"Follow Obsidian’s language or choose a language for this plugin. Changes apply across vaults.",
	systemLanguage: "System default",
	switchingMode: "Switching mode",
	switchingModeDescription:
		"Choose what happens to the current window when opening another vault.",
	replaceWindow: "Replace window",
	keepWindowsOpen: "Keep windows open",
	openOrFocus: "Open or focus vault",
	shareSettings: "Share settings across vaults",
	shareSettingsDescription:
		"Turning this on replaces the shared switching mode and tile images with the settings from this vault.",
	vaults: "Vaults",
	barSettings: "Vault bar settings",
	barImages: "Vault bar images",
	chooseImage: "Choose image",
	resetImage: "Reset",
	desktopUnavailable: "The desktop window bridge is unavailable.",
	settingsUnavailable: "Reload the open vaults to retry loading settings.",
	registryUnavailable: "Could not read the registered vaults.",
	switchTimeout:
		"Enable the vault switcher in the target vault and try again.",
	switchBusy: "A vault switch is already in progress.",
	switchFailed: "Could not switch vaults in the current window state.",
	saveSettingsFailed: "Could not update vault switcher settings. Try again.",
	settingsLoading: "Vault switcher settings are still loading. Try again.",
	invalidImage: "The selected image has an unsupported format or size.",
	saveImageFailed: "Could not update the vault image. Try again.",
};

type Messages = typeof en;
export type Translate = (key: keyof Messages) => string;

const messages: Record<Language, Messages> = {
	en,
	ru: {
		language: "Язык интерфейса",
		languageDescription:
			"Используйте язык Obsidian или выберите язык плагина. Изменение применяется во всех хранилищах.",
		systemLanguage: "Как в Obsidian",
		switchingMode: "Режим переключения",
		switchingModeDescription:
			"Выберите, что происходит с текущим окном при открытии другого хранилища.",
		replaceWindow: "Заменять окно",
		keepWindowsOpen: "Оставлять окна открытыми",
		openOrFocus: "Открывать или активировать хранилище",
		shareSettings: "Общие настройки для всех хранилищ",
		shareSettingsDescription:
			"При включении общий режим переключения и картинки плиток заменяются настройками из этого хранилища.",
		vaults: "Хранилища",
		barSettings: "Настройки панели хранилищ",
		barImages: "Картинки плиток хранилищ",
		chooseImage: "Выбрать картинку",
		resetImage: "Сбросить",
		desktopUnavailable: "Интерфейс управления окнами Obsidian недоступен.",
		settingsUnavailable:
			"Перезагрузите открытые хранилища, чтобы повторить загрузку настроек.",
		registryUnavailable:
			"Не удалось получить список зарегистрированных хранилищ.",
		switchTimeout:
			"Включите Vault Switcher Bar в целевом хранилище и попробуйте снова.",
		switchBusy: "Переключение хранилища уже выполняется.",
		switchFailed:
			"Не удалось переключить хранилище в текущем состоянии окна.",
		saveSettingsFailed:
			"Не удалось сохранить настройки Vault Switcher Bar. Попробуйте снова.",
		settingsLoading:
			"Настройки Vault Switcher Bar ещё загружаются. Попробуйте снова.",
		invalidImage: "Формат или размер выбранной картинки не поддерживается.",
		saveImageFailed:
			"Не удалось обновить картинку хранилища. Попробуйте снова.",
	},
	kk: {
		language: "Интерфейс тілі",
		languageDescription:
			"Obsidian тілін қолданыңыз немесе плагин тілін таңдаңыз. Өзгеріс барлық қоймаға қолданылады.",
		systemLanguage: "Obsidian тілі",
		switchingMode: "Ауысу режимі",
		switchingModeDescription:
			"Басқа қойманы ашқанда ағымдағы терезеге не болатынын таңдаңыз.",
		replaceWindow: "Терезені ауыстыру",
		keepWindowsOpen: "Терезелерді ашық қалдыру",
		openOrFocus: "Қойманы ашу немесе белсендіру",
		shareSettings: "Барлық қоймаға ортақ баптаулар",
		shareSettingsDescription:
			"Қосылғанда осы қойманың ауысу режимі мен тақташа суреттері ортақ баптаулардың орнына қолданылады.",
		vaults: "Қоймалар",
		barSettings: "Қоймалар панелінің баптаулары",
		barImages: "Қойма тақташаларының суреттері",
		chooseImage: "Суретті таңдау",
		resetImage: "Қалпына келтіру",
		desktopUnavailable:
			"Obsidian терезелерін басқару интерфейсі қолжетімсіз.",
		settingsUnavailable:
			"Баптауларды қайта жүктеу үшін ашық қоймаларды қайта жүктеңіз.",
		registryUnavailable: "Тіркелген қоймалар тізімін алу мүмкін болмады.",
		switchTimeout:
			"Мақсатты қоймада Vault Switcher Bar плагинін қосып, әрекетті қайталаңыз.",
		switchBusy: "Қойма ауыстырылып жатыр.",
		switchFailed:
			"Терезенің ағымдағы күйінде қойманы ауыстыру мүмкін болмады.",
		saveSettingsFailed:
			"Vault Switcher Bar баптауларын сақтау мүмкін болмады. Қайталап көріңіз.",
		settingsLoading:
			"Vault Switcher Bar баптаулары әлі жүктелуде. Қайталап көріңіз.",
		invalidImage:
			"Таңдалған суреттің пішімі немесе өлшемі қолдау таппайды.",
		saveImageFailed:
			"Қойма суретін жаңарту мүмкін болмады. Қайталап көріңіз.",
	},
	be: {
		language: "Мова інтэрфейсу",
		languageDescription:
			"Выкарыстоўвайце мову Obsidian або выберыце мову плагіна. Змена ўжываецца ва ўсіх сховішчах.",
		systemLanguage: "Як у Obsidian",
		switchingMode: "Рэжым пераключэння",
		switchingModeDescription:
			"Выберыце, што адбываецца з бягучым акном пры адкрыцці іншага сховішча.",
		replaceWindow: "Замяняць акно",
		keepWindowsOpen: "Пакідаць вокны адкрытымі",
		openOrFocus: "Адкрываць або актываваць сховішча",
		shareSettings: "Агульныя налады для ўсіх сховішчаў",
		shareSettingsDescription:
			"Пры ўключэнні агульны рэжым пераключэння і выявы плітак замяняюцца наладамі гэтага сховішча.",
		vaults: "Сховішчы",
		barSettings: "Налады панэлі сховішчаў",
		barImages: "Выявы плітак сховішчаў",
		chooseImage: "Выбраць выяву",
		resetImage: "Скінуць",
		desktopUnavailable: "Інтэрфейс кіравання вокнамі Obsidian недаступны.",
		settingsUnavailable:
			"Перазагрузіце адкрытыя сховішчы, каб паўтарыць загрузку налад.",
		registryUnavailable:
			"Не ўдалося атрымаць спіс зарэгістраваных сховішчаў.",
		switchTimeout:
			"Уключыце Vault Switcher Bar у мэтавым сховішчы і паспрабуйце зноў.",
		switchBusy: "Сховішча ўжо пераключаецца.",
		switchFailed: "Не ўдалося пераключыць сховішча ў бягучым стане акна.",
		saveSettingsFailed:
			"Не ўдалося захаваць налады Vault Switcher Bar. Паспрабуйце зноў.",
		settingsLoading:
			"Налады Vault Switcher Bar яшчэ загружаюцца. Паспрабуйце зноў.",
		invalidImage: "Фармат або памер выбранай выявы не падтрымліваецца.",
		saveImageFailed:
			"Не ўдалося абнавіць выяву сховішча. Паспрабуйце зноў.",
	},
	uz: {
		language: "Interfeys tili",
		languageDescription:
			"Obsidian tilidan foydalaning yoki plagin tilini tanlang. O‘zgarish barcha omborlarda qo‘llanadi.",
		systemLanguage: "Obsidian tili",
		switchingMode: "Almashish rejimi",
		switchingModeDescription:
			"Boshqa ombor ochilganda joriy oyna bilan nima bo‘lishini tanlang.",
		replaceWindow: "Oynani almashtirish",
		keepWindowsOpen: "Oynalarni ochiq qoldirish",
		openOrFocus: "Omborni ochish yoki faollashtirish",
		shareSettings: "Barcha omborlar uchun umumiy sozlamalar",
		shareSettingsDescription:
			"Bu sozlama yoqilganda joriy omborning almashish rejimi va plitka rasmlari umumiy sozlamalarni almashtiradi.",
		vaults: "Omborlar",
		barSettings: "Omborlar paneli sozlamalari",
		barImages: "Ombor plitkalarining rasmlari",
		chooseImage: "Rasm tanlash",
		resetImage: "Tiklash",
		desktopUnavailable:
			"Obsidian oynalarini boshqarish interfeysi mavjud emas.",
		settingsUnavailable:
			"Sozlamalarni qayta yuklash uchun ochiq omborlarni qayta yuklang.",
		registryUnavailable:
			"Ro‘yxatdan o‘tgan omborlar ro‘yxatini olib bo‘lmadi.",
		switchTimeout:
			"Kerakli omborda Vault Switcher Bar plaginini yoqing va qayta urinib ko‘ring.",
		switchBusy: "Ombor almashtirilmoqda.",
		switchFailed: "Oynaning joriy holatida omborni almashtirib bo‘lmadi.",
		saveSettingsFailed:
			"Vault Switcher Bar sozlamalarini saqlab bo‘lmadi. Qayta urinib ko‘ring.",
		settingsLoading:
			"Vault Switcher Bar sozlamalari hali yuklanmoqda. Qayta urinib ko‘ring.",
		invalidImage:
			"Tanlangan rasm formati yoki hajmi qo‘llab-quvvatlanmaydi.",
		saveImageFailed:
			"Ombor rasmini yangilab bo‘lmadi. Qayta urinib ko‘ring.",
	},
	zh: {
		language: "界面语言",
		languageDescription:
			"跟随 Obsidian 的语言设置，或为此插件单独选择语言。此设置适用于所有仓库。",
		systemLanguage: "跟随 Obsidian",
		switchingMode: "切换方式",
		switchingModeDescription: "选择打开其他仓库时如何处理当前窗口。",
		replaceWindow: "替换当前窗口",
		keepWindowsOpen: "保留已打开的窗口",
		openOrFocus: "打开仓库或将其窗口切到前台",
		shareSettings: "在所有仓库间共享设置",
		shareSettingsDescription:
			"启用后，将用当前仓库的切换方式和仓库图标覆盖共享设置。",
		vaults: "仓库",
		barSettings: "仓库切换栏设置",
		barImages: "仓库切换栏图标",
		chooseImage: "选择图片",
		resetImage: "恢复默认图标",
		desktopUnavailable: "无法使用 Obsidian 的窗口控制功能。",
		settingsUnavailable: "无法加载设置。请重新加载已打开的仓库后再试。",
		registryUnavailable: "无法读取已登记的仓库列表。",
		switchTimeout:
			"请在要切换到的仓库中启用 Vault Switcher Bar，然后重试。",
		switchBusy: "正在切换仓库，请稍候。",
		switchFailed: "在当前窗口状态下无法切换仓库。",
		saveSettingsFailed: "无法保存 Vault Switcher Bar 的设置。请重试。",
		settingsLoading: "Vault Switcher Bar 的设置仍在加载，请稍后重试。",
		invalidImage: "不支持所选图片的格式，或图片文件过大。",
		saveImageFailed: "无法更新仓库图标。请重试。",
	},
	"zh-TW": {
		language: "介面語言",
		languageDescription:
			"沿用 Obsidian 的語言設定，或單獨為此外掛程式選擇語言。此設定適用於所有儲存庫。",
		systemLanguage: "沿用 Obsidian 的語言",
		switchingMode: "切換方式",
		switchingModeDescription: "選擇開啟其他儲存庫時如何處理目前的視窗。",
		replaceWindow: "取代目前的視窗",
		keepWindowsOpen: "保留已開啟的視窗",
		openOrFocus: "開啟儲存庫或將其視窗帶到前景",
		shareSettings: "在所有儲存庫之間共用設定",
		shareSettingsDescription:
			"啟用後，將以目前儲存庫的切換方式與儲存庫圖示覆寫共用設定。",
		vaults: "儲存庫",
		barSettings: "儲存庫切換列設定",
		barImages: "儲存庫切換列圖示",
		chooseImage: "選擇圖片",
		resetImage: "還原預設圖示",
		desktopUnavailable: "無法使用 Obsidian 的視窗控制功能。",
		settingsUnavailable:
			"無法載入設定。請重新載入已開啟的儲存庫後再試一次。",
		registryUnavailable: "無法讀取已登錄的儲存庫清單。",
		switchTimeout:
			"請在要切換至的儲存庫中啟用 Vault Switcher Bar，然後再試一次。",
		switchBusy: "正在切換儲存庫，請稍候。",
		switchFailed: "在目前的視窗狀態下無法切換儲存庫。",
		saveSettingsFailed: "無法儲存 Vault Switcher Bar 的設定。請再試一次。",
		settingsLoading: "Vault Switcher Bar 的設定仍在載入，請稍後再試。",
		invalidImage: "不支援所選圖片的格式，或圖片檔案過大。",
		saveImageFailed: "無法更新儲存庫圖示。請再試一次。",
	},
	ja: {
		language: "表示言語",
		languageDescription:
			"Obsidianの表示言語に合わせるか、このプラグインの言語を選べます。設定はすべての保管庫に適用されます。",
		systemLanguage: "Obsidianの言語に合わせる",
		switchingMode: "切り替えモード",
		switchingModeDescription:
			"別の保管庫を開くときに、現在のウィンドウをどう扱うかを選びます。",
		replaceWindow: "ウィンドウを入れ替える",
		keepWindowsOpen: "ウィンドウを開いたままにする",
		openOrFocus: "保管庫を開く／開いている場合は前面に出す",
		shareSettings: "保管庫間で設定を共有",
		shareSettingsDescription:
			"オンにすると、共有設定の切り替えモードとアイコンを現在の保管庫の設定で上書きします。",
		vaults: "保管庫",
		barSettings: "保管庫切り替えバーの設定",
		barImages: "保管庫切り替えバーのアイコン",
		chooseImage: "画像を選択",
		resetImage: "既定のアイコンに戻す",
		desktopUnavailable: "Obsidianのウィンドウ操作機能を利用できません。",
		settingsUnavailable:
			"設定を読み込めませんでした。開いている保管庫を再読み込みしてから、もう一度お試しください。",
		registryUnavailable: "登録済みの保管庫の一覧を取得できませんでした。",
		switchTimeout:
			"切り替え先の保管庫でVault Switcher Barを有効にしてから、もう一度お試しください。",
		switchBusy: "保管庫を切り替えています。しばらくお待ちください。",
		switchFailed: "現在のウィンドウの状態では保管庫を切り替えられません。",
		saveSettingsFailed:
			"Vault Switcher Barの設定を保存できませんでした。もう一度お試しください。",
		settingsLoading:
			"Vault Switcher Barの設定を読み込み中です。しばらくしてから、もう一度お試しください。",
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
