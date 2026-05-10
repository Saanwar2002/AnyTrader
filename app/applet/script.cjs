console.log("Hello from script");
const fs = require('fs');
const filePath = 'src/components/PostJobWizard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find start indices
const step4Idx = content.indexOf('{step === 4 && (');
const step5Idx = content.indexOf('{step === 5 && (');
const step6Idx = content.indexOf('{step === 6 && (');

console.log("Indices:", step4Idx, step5Idx, step6Idx);

if(step4Idx > -1 && step5Idx > -1 && step6Idx > -1) {
  const before = content.slice(0, step4Idx);
  const after = content.slice(step6Idx);

  const newAfter = after.replace('{step === 6 && (', '{step === 5 && (');

  const combinedStep4 = `          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <JobReminder />

              {/* 1. Where is the job? */}
              <div className="space-y-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-3xl"></div>
                
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-sm font-black text-blue-600">1</span>
                  Where is the job?
                </h2>
                
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    className="w-full p-4 pl-12 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all text-sm font-medium placeholder:font-normal placeholder:text-slate-400"
                    placeholder="Enter job address..."
                    value={addressInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddressInput(val);
                      setUseRegisteredAddress(false);
                      if (addressSuggestionTimeout) clearTimeout(addressSuggestionTimeout);
                      if (!val || val.length < 2 || !window.google) {
                        setAddressSuggestions([]);
                        return;
                      }
                      const timeout = setTimeout(async () => {
                        try {
                          const { AutocompleteSuggestion } = await google.maps.importLibrary("places") as any;
                          const request = { input: val, includedRegionCodes: ['gb'] };
                          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                          if (suggestions && suggestions.length > 0) {
                            setAddressSuggestions(suggestions.map((p: any) => ({
                              label: p.placePrediction.text.text,
                              placeId: p.placePrediction.placeId,
                              placePrediction: p.placePrediction
                            })));
                          } else { setAddressSuggestions([]); }
                        } catch (err) {
                          console.error(err);
                          setAddressSuggestions([]);
                        }
                      }, 500);
                      setAddressSuggestionTimeout(timeout);
                    }}
                    onBlur={async (e) => {
                      const val = e.target.value;
                      if (!val || addressSuggestions.length > 0 || useRegisteredAddress) return;
                      try {
                        const data = await lookupPostcode(val);
                        if (data) {
                          setFormData(prev => ({ ...prev, city: data.city, area: data.area, postcode: data.postcode, fullAddress: data.postcode }));
                        }
                      } catch (err) { console.error("Error looking up postcode:", err); }
                    }}
                  />
                  {addressSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-64 overflow-y-auto z-50">
                      {addressSuggestions.map((suggestion, idx) => (
                        <div 
                          key={idx}
                          onClick={async () => {
                            setAddressInput(suggestion.label);
                            setFormData(prev => ({ ...prev, fullAddress: suggestion.label }));
                            setAddressSuggestions([]);
                            setUseRegisteredAddress(false);
                            if (suggestion.placeId) {
                              try {
                                const { Place } = await google.maps.importLibrary("places") as any;
                                const place = new Place({ id: suggestion.placeId });
                                await place.fetchFields({ fields: ['addressComponents'] });
                                if (place.addressComponents) {
                                  let newCity = formData.city;
                                  let newArea = formData.area;
                                  let newPostcode = "";
                                  place.addressComponents.forEach((comp: any) => {
                                    if (comp.types.includes("postal_town") || comp.types.includes("locality")) newCity = comp.longText;
                                    if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) newArea = comp.longText;
                                    if (comp.types.includes("postal_code")) newPostcode = comp.longText;
                                  });
                                  if (!newPostcode) {
                                    const pcMatch = suggestion.label.match(/[A-Z]{1,2}[0-9][A-Z0-9]?\\s?[0-9][A-Z]{2}/i);
                                    newPostcode = pcMatch ? pcMatch[0] : "";
                                  }
                                  setFormData(prev => ({ ...prev, city: newCity || prev.city, area: newArea || prev.area, postcode: newPostcode }));
                                }
                              } catch (err) { console.error(err); }
                            }
                          }}
                          className="p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3 transition-colors"
                        >
                          <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-sm font-medium text-slate-700">{suggestion.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleAutoDetectLocation}
                    className="flex-1 p-3 rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-all text-sm active:scale-95"
                  >
                    <Locate className="w-4 h-4 flex-shrink-0" /> Current Location
                  </button>
                  {profile?.postcode && (
                    <button
                      type="button"
                      onClick={() => {
                        setUseRegisteredAddress(true);
                        setAddressInput("");
                        setFormData(prev => ({
                          ...prev,
                          postcode: profile.postcode,
                          city: profile.city || prev.city,
                          area: profile.area || prev.area,
                          county: profile.county || prev.county,
                          fullAddress: profile.postcode
                        }));
                      }}
                      className={cn(
                        "flex-1 p-3 rounded-2xl border font-bold flex items-center justify-center gap-2 transition-all text-sm active:scale-95",
                        useRegisteredAddress ? "border-blue-200 bg-white text-blue-700 shadow-inner" : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Use Profile Address
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">House / Flat *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 42 or Flat 3B"
                      className="w-full p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white text-sm font-medium placeholder:text-slate-300"
                      value={formData.houseNumber}
                      onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">City</label>
                    <input 
                      type="text" 
                      placeholder="Auto-filled"
                      className="w-full p-3.5 rounded-2xl border-none bg-slate-50 text-sm font-medium focus:outline-none cursor-not-allowed text-slate-500"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* 2. When do you need it? */}
              <div className="space-y-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 rounded-l-3xl"></div>

                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-sm font-black text-orange-600">2</span>
                  When do you need it?
                </h2>
                
                {formData.urgency === "emergency" && (
                  <div className="bg-red-50 p-3 rounded-2xl border border-red-100 flex gap-3 text-left">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-800 text-sm">Emergency Post</h4>
                      <p className="text-xs text-red-700 font-medium">
                        {formData.category === "Plumbing" ? "Turn off your main water valve immediately." : 
                         formData.category === "Electrical" ? "Turn off your main power switch." : 
                         "Ensure your safety first and stay clear."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {URGENCY_LEVELS.filter(level => !targetTradespersonId || level.id !== "emergency").map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setFormData({ ...formData, urgency: level.id })}
                      className={cn(
                        "px-5 py-3 text-sm rounded-2xl border transition-all font-bold",
                        formData.urgency === level.id 
                          ? "border-[#0084a5] bg-[#0084a5] text-white shadow-[0_4px_12px_rgba(0,132,165,0.2)]" 
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>

                {formData.urgency === "specific_date" && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-2"
                  >
                    <input 
                      type="date" 
                      className="w-full p-4 rounded-2xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white transition-all font-medium text-slate-700"
                      value={formData.jobDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, jobDate: e.target.value })}
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

`;

  fs.writeFileSync(filePath, before + combinedStep4 + '\n\n' + newAfter);
  console.log("Successfully replaced steps");
} else {
  console.log("Could not find step indices: ", step4Idx, step5Idx, step6Idx);
}
