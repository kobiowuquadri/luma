// Package lang lists the languages LUMA offers in its language selector.
//
// Reading (OCR) is language-independent for Latin script. These codes are the
// answer, transcription and speech languages. Codes follow the ones YarnGPT
// documents for target_language (en, yo, ha, ig, pcm).
package lang

import "strings"

// Language describes one selectable language.
type Language struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	NativeName string `json:"nativeName"`
	// Guidance is the writing instruction given to the answer model.
	Guidance string `json:"-"`
	aliases  []string
}

var all = []Language{
	{
		Code: "en", Name: "English", NativeName: "English",
		Guidance: "Write in clear, simple English that a Nigerian secondary-school or university student understands.",
		aliases:  []string{"eng", "english", "en-ng", "en-gb", "en-us"},
	},
	{
		Code: "yo", Name: "Yoruba", NativeName: "Yorùbá",
		Guidance: "Write in Yorùbá using standard orthography with tone marks and under-dots (for example ẹ, ọ, ṣ).",
		aliases:  []string{"yor", "yoruba", "yorùbá", "yo-ng"},
	},
	{
		Code: "ha", Name: "Hausa", NativeName: "Hausa",
		Guidance: "Write in Hausa using standard Boko (Latin) spelling, including the hooked letters ɓ, ɗ and ƙ where they belong.",
		aliases:  []string{"hau", "hausa", "ha-ng"},
	},
	{
		Code: "ig", Name: "Igbo", NativeName: "Igbo",
		Guidance: "Write in standard Igbo with the dotted vowels ị, ọ, ụ and the letter ṅ where they belong.",
		aliases:  []string{"ibo", "igbo", "ig-ng"},
	},
	{
		Code: "pcm", Name: "Nigerian Pidgin", NativeName: "Naijá",
		Guidance: "Write in Nigerian Pidgin (Naijá) the way it is commonly written in Nigeria. Keep it natural and easy to read aloud.",
		aliases:  []string{"pidgin", "nigerian pidgin", "naija", "naijá", "pcm-ng"},
	},
}

// All returns the supported languages in display order.
func All() []Language {
	out := make([]Language, len(all))
	copy(out, all)
	return out
}

// Get returns the language for an exact code.
func Get(code string) (Language, bool) {
	for _, l := range all {
		if l.Code == code {
			return l, true
		}
	}
	return Language{}, false
}

// Normalize maps a provider- or user-supplied language label ("yor",
// "Yoruba", "yo-NG", "Nigerian Pidgin") to a supported code.
func Normalize(label string) (string, bool) {
	s := strings.ToLower(strings.TrimSpace(label))
	if s == "" {
		return "", false
	}
	s = strings.ReplaceAll(s, "_", "-")
	for _, l := range all {
		if s == l.Code {
			return l.Code, true
		}
		for _, a := range l.aliases {
			if s == a {
				return l.Code, true
			}
		}
	}
	// Accept region-qualified codes such as "yo-Latn-NG".
	if i := strings.IndexByte(s, '-'); i > 0 {
		return Normalize(s[:i])
	}
	return "", false
}
