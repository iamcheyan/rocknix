// @title Hello PocketJS on ROCKNIX H700
import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, Text, View } from "@pocketjs/framework/solid/components";
import { BTN } from "@pocketjs/framework/input";

mount(() => (
  <View class="w-full h-full bg-slate-950 p-8 flex-col">
    <Text class="text-2xl font-bold text-white">Hello PocketJS on ROCKNIX H700</Text>
    <Text class="text-lg text-emerald-300">A: confirm · B: return</Text>
    <ActionHandler button={BTN.CONFIRM} onPress={() => {}} />
  </View>
));
